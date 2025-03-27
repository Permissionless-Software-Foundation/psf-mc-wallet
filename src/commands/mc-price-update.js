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

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import config from '../../config/index.js'
import McCollectKeys from './mc-collect-keys.js'

// CONSTANTS
// Update this constant to reflect the Group token uses to generate the Minting

// const WRITE_PRICE_ADDR = 'bitcoincash:qqlrzp23w08434twmvr4fxw672whkjy0py26r63g3d'
const WRITE_PRICE_ADDR = 'bitcoincash:qrwe6kxhvu47ve6jvgrf2d93w0q38av7s5xm9xfehr' // test address

// Update this constant to reflect the Group token uses to generate the Minting
// Council NFTs.
// const GROUP_ID = '8e8d90ebdb1791d58eba7acd428ff3b1e21c47fb7aba2ba3b5b815aa0fe7d6d5' // Offical token
const GROUP_ID = '4c039aa116b018f851cfe05e4e6e5a2d45076964a38d6b875ffd2f6bb5b3f843' // Test Group Token

class McPriceUpdate {
  constructor () {
    // Encapsulate dependencies
    this.walletUtil = new WalletUtil()
    this.config = config
    this.retryQueue = new RetryQueue()
    this.mcCollectKeys = new McCollectKeys()

    // Bind 'this' object to all subfunctions.
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.getPublicKeys = this.getPublicKeys.bind(this)
    this.createMultisigWallet = this.createMultisigWallet.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      // Initialize the wallet.
      this.bchWallet = await this.walletUtil.instanceWallet(flags.name)
      await this.bchWallet.initialize()

      // Look up the public keys for MC NFT holders.
      const keys = await this.retryQueue.addToQueue(this.getPublicKeys, {})
      console.log('keys: ', keys)

      // Generate a 50% + 1 multisig wallet.
      const walletObj = this.createMultisigWallet(keys)
      console.log(`wallet object: ${JSON.stringify(walletObj)}`)

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
}

export default McPriceUpdate
