/*
  Generates an unsigned multisignature transaction to update the price of
  writing 1MB of data to the PSFFPP, in PSF tokens.

  Steps:
  - Get the current price of PSF in USD from data on the blockchain.
  - Calculate the price in PSF tokens at a cost of $0.01 USD per MB.
  - Create a multisignature price-update transaction for Minting Council to sign
  - Upload the price-update transaction to the PSFFPP.

  Once the unsigned, multisignature transaction is uploaded to the PSFFPP, a
  notice can be sent to the members of the Minting Council to let them know
  they can download and sign it.
*/

// Global npm libraries
import bitcore from '@chris.troutner/bitcore-lib-cash'
import RetryQueue from '@chris.troutner/retry-queue'
import FormData from 'form-data'
import { Readable } from 'stream'
import axios from 'axios'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import config from '../../config/index.js'
import McCollectKeys from './mc-collect-keys.js'

// CONSTANTS
// Update this constant to reflect the Group token uses to generate the Minting

// const WRITE_PRICE_ADDR = 'bitcoincash:qrwe6kxhvu47ve6jvgrf2d93w0q38av7s5xm9xfehr' // mainnet address
const WRITE_PRICE_ADDR = 'bitcoincash:qzsp4pksus32237h3m7skgs3e2535hgc3uukx0u2sz' // test address

// Update this constant to reflect the Group token uses to generate the Minting
// Council NFTs.
// const GROUP_ID = '8e8d90ebdb1791d58eba7acd428ff3b1e21c47fb7aba2ba3b5b815aa0fe7d6d5' // Offical token
const GROUP_ID = '029845aa9c4ee882a33b8c65a6531a3b2e92c05cd904b2d281dc75badc663151' // Test Group Token

class McPriceUpdate {
  constructor () {
    // Encapsulate dependencies
    this.walletUtil = new WalletUtil()
    this.config = config
    this.retryQueue = new RetryQueue()
    this.mcCollectKeys = new McCollectKeys()
    this.axios = axios

    // Bind 'this' object to all subfunctions.
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.getPublicKeys = this.getPublicKeys.bind(this)
    this.createMultisigWallet = this.createMultisigWallet.bind(this)
    this.calcP2wdbWritePrice = this.calcP2wdbWritePrice.bind(this)
    this.uploadUpdateObject = this.uploadUpdateObject.bind(this)
    this.writeCidToBlockchain = this.writeCidToBlockchain.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      // Initialize the wallet.
      this.bchWallet = await this.walletUtil.instanceWallet(flags.name)
      await this.bchWallet.initialize()

      // Initialize the PSFFPP library.
      this.psffpp = await this.walletUtil.instancePsffpp(this.bchWallet)

      // Look up the public keys for MC NFT holders.
      const keys = await this.retryQueue.addToQueue(this.getPublicKeys, {})
      console.log('keys: ', keys)

      // Generate a 50% + 1 multisig wallet.
      const walletObj = this.createMultisigWallet(keys)
      console.log(`wallet object: ${JSON.stringify(walletObj)}`)

      // Get the current write price from an API.
      // TODO: self-generate this price so that we don't have to trust the API.
      const writePrice = await this.calcP2wdbWritePrice()

      // Compile an update object
      const updateTxObj = {
        groupId: GROUP_ID,
        keys,
        walletObj,
        multisigAddr: walletObj.address,
        writePrice
      }

      const cid = await this.uploadUpdateObject(updateTxObj)
      console.log('cid: ', cid)

      // Generate a Pin Claim
      const pinObj = {
        cid,
        filename: 'data.json',
        fileSizeInMegabytes: 1
      }
      const { pobTxid, claimTxid } = await this.psffpp.createPinClaim(pinObj)
      console.log('pobTxid: ', pobTxid)
      console.log('claimTxid: ', claimTxid)

      // Generate an update transaction with the CID
      const updateTxid = await this.writeCidToBlockchain(cid)
      console.log('\nupdateTxid: ', updateTxid)

      return true
    } catch (err) {
      console.error('Error in mc-price-update: ', err)
      return 0
    }
  }

  validateFlags (flags) {
    // Exit if wallet not specified.
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    return true
  }

  // Retrieve the public keys for all MC NFT holders.
  async getPublicKeys () {
    try {
      // Collect the NFT token IDs.
      // await this.mcCollectKeys.instanceWallet()
      this.mcCollectKeys.bchWallet = this.bchWallet
      const nfts = await this.mcCollectKeys.getNftsFromGroup()
      // console.log('nfts: ', nfts)

      // Get the address holding each NFT.
      const addrs = await this.mcCollectKeys.getAddrs(nfts)
      // console.log('addrs: ', addrs)

      // Get the public keys for each address holding an NFT.
      const { keys } = await this.mcCollectKeys.findKeys(addrs, nfts)

      return keys
    } catch (err) {
      console.error('Error in getPublicKeys()')
      throw err
    }
  }

  // Generate a P2SH multisignature wallet from the public keys of the NFT holders.
  createMultisigWallet (keyPairs) {
    try {
      // Isolate just an array of public keys.
      const pubKeys = []
      for (let i = 0; i < keyPairs.length; i++) {
        const thisPair = keyPairs[i]

        pubKeys.push(thisPair.pubKey)
      }

      // Determine the number of signers. It's 50% + 1
      const requiredSigners = Math.floor(pubKeys.length / 2) + 1

      // Multisig Address
      const msAddr = new bitcore.Address(pubKeys, requiredSigners)

      // Locking Script in hex representation.
      const scriptHex = new bitcore.Script(msAddr).toHex()

      const walletObj = {
        address: msAddr.toString(),
        scriptHex,
        publicKeys: pubKeys,
        requiredSigners
      }

      return walletObj
    } catch (err) {
      console.error('Error in createMultisigWallet()')
      throw err
    }
  }

  // Calculate how much $0.01 USD is in PSF tokens.
  async calcP2wdbWritePrice () {
    try {
      const result = await this.axios.get('https://psfoundation.cash/price')
      // console.log('PSF price data: ', result.data)

      let tokensPerPenny = 0.01 / result.data.usdPerToken

      // Round to 8 decimal points
      tokensPerPenny = this.bchWallet.bchjs.Util.floor8(tokensPerPenny)

      return tokensPerPenny
    } catch (err) {
      console.log('Error in calcP2wdbWritePrice(): ', err)
      throw err
    }
  }

  // upload the update object to IPFS as a JSON file. This stages the file
  // for pinning to the PSFFPP.
  async uploadUpdateObject (updateTxObj) {
    try {
      if (!updateTxObj) {
        throw new Error('No update object provided.')
      }

      // Convert the object to a JSON string.
      const updateTxStr = JSON.stringify(updateTxObj)

      // Conver the string to a readable stream
      const updateTxStream = Readable.from([updateTxStr])

      // Create a new FormData instance
      const form = new FormData()

      // Append the file stream to the form data
      // The key "file" matches whatever your server expects under its multipart field name
      form.append('file', updateTxStream)

      // Make a POST request to the server with the form data
      const response = await this.axios.post(`${this.config.fileStagingURL}/ipfs/upload`, form, {
        headers: {
          // `form.getHeaders()` contains the correct `Content-Type: multipart/form-data; boundary=...`
          ...form.getHeaders()
        }
      })

      // console.log('File uploaded successfully:', response.data);

      const cid = response.data.cid

      return cid
    } catch (err) {
      console.error('Error in createUpdateObject()')
      throw err
    }
  }

  // This function expects an IPFS CID as input. This is the output of the
  // uploadDataToIpfs() function. It writes the update data CID to the BCH
  // blockchain, and generates the transaction ID that the Minting Council
  // will approve.
  async writeCidToBlockchain (cid) {
    try {
      // Generate the data for the OP_RETURN
      const now = new Date()
      const opReturnObj = {
        cid,
        ts: now.getTime()
      }
      const opReturnStr = JSON.stringify(opReturnObj)

      // Tag the reference address with dust, so that this TX appears in its
      // TX history.
      const receivers = [{
        address: WRITE_PRICE_ADDR,
        amountSat: 546
      }]

      await this.bchWallet.initialize()

      const txid = await this.bchWallet.sendOpReturn(opReturnStr, '', receivers)
      console.log('txid: ', txid)

      return txid
    } catch (err) {
      console.error('Error in writeCidToBlockchain()')
      throw err
    }
  }
}

export default McPriceUpdate
