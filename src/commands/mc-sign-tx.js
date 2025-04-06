/*
  This script is used by individual members of the Minting Council to sign a
  multisignature approval transaction.
*/

// Global npm libraries
import bitcore from '@chris.troutner/bitcore-lib-cash'
import RetryQueue from '@chris.troutner/retry-queue'
import fs from 'fs'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import config from '../../config/index.js'
import MsgNostrSend from './msg-nostr-send.js'
import MsgNostrRead from './msg-nostr-read.js'

class McSignTx {
  constructor () {
    // Encapsulate dependencies
    this.walletUtil = new WalletUtil()
    this.config = config
    this.retryQueue = new RetryQueue()
    this.bitcore = bitcore
    this.msgNostrRead = new MsgNostrRead()
    this.msgNostrSend = new MsgNostrSend()

    // Bind 'this' object to all subfunctions.
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.signTx = this.signTx.bind(this)
    this.returnSigToSender = this.returnSigToSender.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      // Get message data.
      const msgFlags = {
        name: flags.name,
        txid: flags.txid,
        data: true
      }
      const { sender, data } = await this.msgNostrRead.run(msgFlags)
      // console.log(`sender: ${sender}`)
      // console.log(`clearMsg: ${clearMsg}`)
      // console.log('data: ', data)

      // Initialize the wallet.
      this.bchWallet = await this.walletUtil.instanceWallet(flags.name)
      await this.bchWallet.initialize()

      const sig = await this.signTx(data)
      // console.log('sig: ', sig)

      await this.returnSigToSender({ sig, sender, flags })

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

    // Exit if txid not specified.
    const txid = flags.txid
    if (!txid || txid === '') {
      throw new Error('You must specify a txid with the -t flag.')
    }

    return true
  }

  // Find an input that matches the private key controlled by this wallet, then
  // sign it and return the signature.
  async signTx (data) {
    try {
      // Bob converts the object into a Transaction class.
      const tx = new this.bitcore.Transaction(data)

      const privateKey = this.bchWallet.walletInfo.privateKey

      // Sign the transaction with Bob's key.
      const partiallySignedTx = tx.sign(
        new bitcore.PrivateKey(privateKey)
      )

      // Get Bob's signature from the transaction
      let sig = partiallySignedTx.getSignatures(privateKey)

      // Convert Bob's signature into an object and pass it to Sam.
      sig = sig[0].toObject()
      // console.log('signature: ', sig)

      return sig
    } catch (error) {
      console.log('Error in signTx()')
      throw error
    }
  }

  // Send the signature back to the sender.
  async returnSigToSender ({ sig, sender, flags }) {
    try {
      // Save the data to an external file.
      const txData = JSON.stringify({ data: sig })
      const filePath = './files/data.json'
      fs.writeFileSync(filePath, txData)

      // Generate a flags object for the msg-nostr-send command.
      const sendFlags = {
        addr: sender,
        name: flags.name,
        msg: `{"message": "Signature returned by address ${this.bchWallet.walletInfo.cashAddress}"}`,
        subject: 'MC Approval Signature Returned',
        // json: flags.json,
        data: 'data.json'
      }

      // Send the E2EE message with data to the current MC NFT holder.
      await this.retryQueue.addToQueue(this.msgNostrSend.run, sendFlags)
      console.log('\n\n')

      return true
    } catch (error) {
      console.log('Error in returnSigToSender()')
      throw error
    }
  }
}

export default McSignTx
