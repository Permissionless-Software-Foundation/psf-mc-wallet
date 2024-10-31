/*
  This is the primary entry point for the psf-bch-wallet CLI app.
  This app uses commander.js.
*/

// Global npm libraries
import { Command } from 'commander'

// Local libraries
import WalletCreate from './src/commands/wallet-create.js'
import WalletList from './src/commands/wallet-list.js'
import WalletAddrs from './src/commands/wallet-addrs.js'
import WalletBalance from './src/commands/wallet-balance.js'
import SendBch from './src/commands/send-bch.js'
import SendTokens from './src/commands/send-tokens.js'
import WalletSweep from './src/commands/wallet-sweep.js'
import MsgSign from './src/commands/msg-sign.js'
import MsgVerify from './src/commands/msg-verify.js'
import MsgSendNostr from './src/commands/msg-send-nostr.js'
import MsgCheckNostr from './src/commands/msg-check-nostr.js'
import MsgReadNostr from './src/commands/msg-read-nostr.js'

// Instantiate the subcommands
const walletCreate = new WalletCreate()
const walletList = new WalletList()
const walletAddrs = new WalletAddrs()
const walletBalance = new WalletBalance()
const sendBch = new SendBch()
const sendTokens = new SendTokens()
const walletSweep = new WalletSweep()
const msgSign = new MsgSign()
const msgVerify = new MsgVerify()
const msgSendNostr = new MsgSendNostr()
const msgCheckNostr = new MsgCheckNostr()
const msgReadNostr = new MsgReadNostr()

const program = new Command()

program
  // Define the psf-bch-wallet app options
  .name('psf-bch-wallet')
  .description('A command-line BCH and SLP token wallet.')

// Define the wallet-create command
program.command('wallet-create')
  .description('Create a new wallet with name (-n <name>) and description (-d)')
  .option('-n, --name <string>', 'wallet name')
  .option('-d --description <string>', 'what the wallet is being used for')
  .action(walletCreate.run)

// Define the wallet-list command
program.command('wallet-list')
  .description('List existing wallets')
  .action(walletList.run)

program.command('wallet-addrs')
  .description('List the different addresses for a wallet.')
  .option('-n, --name <string>', 'wallet name')
  .action(walletAddrs.run)

program.command('wallet-balance')
  .description('Get balances in BCH and SLP tokens held by the wallet.')
  .option('-n, --name <string>', 'wallet name')
  .action(walletBalance.run)

program.command('wallet-sweep')
  .description('Sweep funds from a WIF private key')
  .option('-n, --name <string>', 'wallet name receiving BCH')
  .option('-w, --wif <string>', 'WIF private key to sweep')
  .action(walletSweep.run)

program.command('send-bch')
  .description('Send BCH to an address')
  .option('-n, --name <string>', 'wallet name sending BCH')
  .option('-a, --addr <string>', 'address to send BCH to')
  .option('-q, --qty <string>', 'The quantity of BCH to send')
  .action(sendBch.run)

program.command('send-tokens')
  .description('Send SLP tokens to an address')
  .option('-n, --name <string>', 'wallet name sending BCH')
  .option('-a, --addr <string>', 'address to send BCH to')
  .option('-q, --qty <string>', 'The quantity of BCH to send')
  .option('-t, --tokenId <string>', 'The token ID of the token to send')
  .action(sendTokens.run)

program.command('msg-sign')
  .description('Sign a message using the wallets private key')
  .option('-n, --name <string>', 'wallet to sign the message')
  .option('-m, --msg <string>', 'Message to sign')
  .action(msgSign.run)

program.command('msg-verify')
  .description('Verify a signature')
  .option('-s, --sig <string>', 'Signature')
  .option('-m, --msg <string>', 'Cleartext message that was signed')
  .option('-a, --addr <string>', 'BCH address generated from private key that signed the message')
  .action(msgVerify.run)

program.command('msg-send-nostr')
  .description('Send an E2EE message to a BCH address over Nostr')
  .option('-a, --addr <string>', 'BCH address to send message to')
  .option('-n, --name <string>', 'wallet name to pay for message signal')
  .option('-m, --msg <string>', 'Full message, which will be encrypted')
  .option('-s, --subject <string>', 'summary message, like in an email, sent as cleartext')
  .action(msgSendNostr.run)

program.command('msg-check-nostr')
  .description('Check for new E2EE messages')
  .option('-n, --name <string>', 'wallet name to pay for message signal')
  .action(msgCheckNostr.run)

program.command('msg-read-nostr')
  .description('Read an E2EE message sent to your wallet, and stored on Nostr')
  .option('-n, --name <string>', 'wallet name to pay for message signal')
  .option('-t, --txid <string>', 'TXID of the message signal. Displayed by msg-check-nostr')
  .action(msgReadNostr.run)

program.parseAsync(process.argv)
