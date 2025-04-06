/*
  Retrieve signatures from e2ee messages and combine them to fully sign the
  multisignature approval transaction.
*/

// Global npm libraries
import fs from 'fs'
import bitcore from '@chris.troutner/bitcore-lib-cash'
import RetryQueue from '@chris.troutner/retry-queue'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import config from '../../config/index.js'
import MsgNostrRead from './msg-nostr-read.js'

class McFinish {
  constructor () {
    // Encapsulate dependencies
    this.walletUtil = new WalletUtil()
    this.config = config
    this.retryQueue = new RetryQueue()
    this.bitcore = bitcore
    this.msgNostrRead = new MsgNostrRead()

    // Bind 'this' object to all subfunctions.
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.collectSignatures = this.collectSignatures.bind(this)
    this.finishTx = this.finishTx.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      // Parse the TXIDs array into a JSON object.
      const txids = JSON.parse(flags.txids)
      console.log('txids: ', txids)

      // Collect signatures from the messages.
      const sigs = await this.collectSignatures({ name: flags.name, txids })
      console.log('sigs: ', sigs)

      // Combine the signatures into a single, fully-signed TX and broadcast it.
      const txid = await this.finishTx({ sigs, flags })
      console.log('txid: ', txid)

      return true
    } catch (err) {
      console.error(err)
      return 0
    }
  }

  validateFlags (flags) {
    // Exit if wallet not specified.
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    // Exit if txids not specified.
    const txids = flags.txids
    if (!txids || txids === '') {
      throw new Error('You must specify an array of txids with the -t flag.')
    }

    return true
  }

  async collectSignatures ({ name, txids }) {
    const sigs = []
    for (const txid of txids) {
      const msgFlags = { name, txid, data: true }
      const { sender, data } = await this.msgNostrRead.run(msgFlags)
      // console.log('data: ', data)

      sigs.push({ sender, data })
    }

    return sigs
  }

  async finishTx ({ sigs, flags }) {
    // Get the unsigned multisig TX from the file.
    const filePath = './files/approval-tx.json'
    const txData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const txObj = txData.data
    console.log('txObj: ', txObj)
    console.log('sigs: ', sigs)

    // Convert the txObj to a bitcore transaction.
    const tx = new this.bitcore.Transaction(txObj)

    // Determine the number of signatures needed for the tx.
    const numSigs = Math.floor(txObj.inputs[0].signatures.length / 2) + 1

    // Ensure enough signatures are provided.
    if (sigs.length < numSigs) {
      throw new Error(`TX requires ${numSigs} signatures, but only ${sigs.length} have been provided.`)
    }

    // Loop through each signature.
    for (let i = 0; i < numSigs; i++) {
      console.log(`i: ${i}`)
      const thisSig = sigs[i].data
      console.log('thisSig: ', thisSig)

      // Convert the signature to a bitcore signature.
      const sig = new this.bitcore.Transaction.Signature.fromObject(thisSig)

      // Apply the signature to the transaction.
      tx.applySignature(sig)
    }

    // Generate a hex version of the signed TX.
    const hex = tx.toString()
    console.log('hex: ', hex)

    // Initialize the wallet.
    this.bchWallet = await this.walletUtil.instanceWallet(flags.name)
    // await this.bchWallet.initialize()

    // Broadcast the transaction to the network.
    // Note: Now that the TX is fully signed, it can be sent to anyone and broadcast by anyone.
    const txid = await this.bchWallet.broadcast({ hex })
    console.log(`\ntxid: ${txid}`)
    console.log(`https://blockchair.com/bitcoin-cash/transaction/${txid}`)

    return txid
  }
}
export default McFinish
