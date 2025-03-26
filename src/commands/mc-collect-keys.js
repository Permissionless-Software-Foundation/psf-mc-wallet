/*
  This command uses the Minting Council NFTs as a homing beacon to retrieve the
  addresses for each holder an a Minting Council NFTs. It then tries to retrieve
  the public keys from the blockchain for each address. Those public keys are
  needed to construct a multisig wallet.
*/

// Global npm libraries
import BchWallet from 'minimal-slp-wallet'
import collect from 'collect.js'
import fs from 'fs'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import config from '../../config/index.js'

// Update this constant to reflect the Group token uses to generate the Minting
// Council NFTs.

// Official Minting Council Group Token
// const GROUP_ID = '8e8d90ebdb1791d58eba7acd428ff3b1e21c47fb7aba2ba3b5b815aa0fe7d6d5'

// Test Minting Council Group Token
const GROUP_ID = '4c039aa116b018f851cfe05e4e6e5a2d45076964a38d6b875ffd2f6bb5b3f843'

class McCollectKeys {
  constructor () {
    // Encapsulate dependencies
    this.BchWallet = BchWallet
    this.walletUtil = new WalletUtil()
    this.config = config
    this.fs = fs
    this.collect = collect

    // Bind 'this' object to all subfunctions.
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.getNftsFromGroup = this.getNftsFromGroup.bind(this)
    this.getAddrs = this.getAddrs.bind(this)
    this.findKeys = this.findKeys.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      // Initialize the wallet.
      this.bchWallet = await this.walletUtil.instanceWallet(flags.name)
      await this.bchWallet.initialize()

      console.log('Searching for public keys belonging to holders of Minting Council NFTs...')

      // Get the children NFTs under the Group token.
      const nfts = await this.getNftsFromGroup()
      console.log('nfts: ', nfts)

      // Get the addresses of the holders of the NFTs.
      const addrs = await this.getAddrs(nfts)
      console.log('addrs: ', addrs)

      const { keys, keysNotFound } = await this.findKeys(addrs, nfts)
      console.log('keys: ', keys)
      console.log('keysNotFound: ', keysNotFound)

      console.log('Stringified address-key pairs:')
      console.log(`${JSON.stringify(keys)}`)

      return true
    } catch (err) {
      console.error('Error in wallet-balance: ', err)
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

  // Retrieve a list of NFTs from the Group token that spawned them.
  async getNftsFromGroup () {
    try {
      const groupData = await this.bchWallet.getTokenData(GROUP_ID)
      // console.log('groupData: ', groupData)

      const nfts = groupData.genesisData.nfts

      return nfts
    } catch (err) {
      console.error('Error in getNftsFromGroup(): ', err.message)
      throw err
    }
  }

  // This function expects an array of strings as input. Each element is expected
  // to be the Token ID of the an NFT. The address holding each NFT is looked up.
  // The array of addresses are filtered for duplicates, before being returned.
  async getAddrs (nfts) {
    try {
      let addrs = []

      for (let i = 0; i < nfts.length; i++) {
      // for (let i = 0; i < 1; i++) {
        const thisNft = nfts[i]

        const nftData = await this.bchWallet.getTokenData(thisNft, true)
        // console.log('nftData: ', nftData)

        addrs.push(nftData.genesisData.nftHolder)
      }

      // Remove duplicates
      addrs = [...new Set(addrs)]

      return addrs
    } catch (err) {
      console.error('Error in getAddrs(): ', err.message)
      throw err
    }
  }

  // This function expects an array of strings, representing BCH addresses as input.
  // For each address, it attempts to lookup the public key for that address.
  // It returns an object with a keys and keysNotFound property:
  // keys - Object containing address and public key
  // keysNotFound - Array of addresses whos public keys could not be found.
  async findKeys (addrs, nfts) {
    try {
      const keys = []
      const keysNotFound = []

      for (let i = 0; i < addrs.length; i++) {
        const thisAddr = addrs[i]
        const thisNft = nfts[i]

        // Get public Key for reciever from the blockchain.
        const publicKey = await this.bchWallet.getPubKey(thisAddr)
        // console.log(`publicKey: ${JSON.stringify(publicKey, null, 2)}`)

        if (publicKey.includes('not found')) {
          keysNotFound.push(thisAddr)
        } else {
          keys.push({
            addr: thisAddr,
            pubKey: publicKey,
            nft: thisNft
          })
        }
      }

      return { keys, keysNotFound }
    } catch (err) {
      console.error('Error in findKeys(): ', err)
      throw err
    }
  }

}

export default McCollectKeys
