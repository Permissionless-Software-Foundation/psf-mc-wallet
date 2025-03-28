/*
  Unit tests for the mc-price-update command.
*/

// Global npm libraries
import { assert } from 'chai'
import sinon from 'sinon'
import { promises as fs } from 'fs'

// Local libraries
import MCPriceUpdate from '../../../src/commands/mc-price-update.js'
import WalletCreate from '../../../src/commands/wallet-create.js'
const walletCreate = new WalletCreate()

const __dirname = import.meta.dirname
const filename = `${__dirname.toString()}/../../../.wallets/test123.json`

describe('#mc-price-update', () => {
  let uut
  let sandbox
  // let mockWallet

  before(async () => {
    await walletCreate.createWallet(filename)
  })

  beforeEach(async () => {
    sandbox = sinon.createSandbox()

    uut = new MCPriceUpdate()
    // mockWallet = new MockWallet()
  })

  afterEach(() => {
    sandbox.restore()
  })

  after(async () => {
    await fs.rm(filename)
  })

  describe('#writeCidToBlockchain', () => {
    it('should write the CID to the BCH blockchain', async () => {
      // Mock dependencies and force desired code path
      uut.bchWallet = {
        initialize: async () => {},
        sendOpReturn: async () => { return 'fakeTxid' }
      }

      const result = await uut.writeCidToBlockchain('fakeCid')

      assert.equal(result, 'fakeTxid')
    })

    it('should catch and throw errors', async () => {
      try {
        await uut.writeCidToBlockchain()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Cannot read')
      }
    })
  })

  describe('#uploadUpdateObject', () => {
    it('should upload the update object to IPFS and return a CID', async () => {
      // Mock dependencies and force desired code path
      sandbox.stub(uut.axios, 'post').resolves({ data: { cid: 'fakeCid' } })

      const updateTxObj = {
        groupId: 'fakeGroupId',
        keys: ['fakeKey1', 'fakeKey2'],
        walletObj: { address: 'fakeAddress' },
        multisigAddr: 'fakeAddress',
        p2wdbWritePrice: 0.08335233
      }

      const result = await uut.uploadUpdateObject(updateTxObj)

      assert.equal(result, 'fakeCid')
    })

    it('should catch and throw errors', async () => {
      try {
        await uut.uploadUpdateObject()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'No update object provided.')
      }
    })
  })

  describe('#createMultisigWallet', () => {
    it('should create a multisig wallet', async () => {
      // Mock data
      const keyPairs = [
        {
          addr: 'bitcoincash:qzwahhjldv0qsecfxlmcenzvkjv9rlv9au2hcfggl6',
          pubKey: '02055962631b236ddcd2c17cd0b711f12438b93bcf01b206cadb351cc3e6e3e269'
        },
        {
          addr: 'bitcoincash:qpr7znqfy90dqqs6rfrgwdy79h84sg5wkc89xxm2yp',
          pubKey: '03112d4f9ad99e5866fdb72b0cf58683bd24e3e22734263e67b6b44aa5aab3a869'
        }
      ]

      const result = uut.createMultisigWallet(keyPairs)
      // console.log('result: ', result)

      assert.property(result, 'address')
      assert.property(result, 'scriptHex')

      assert.equal(result.publicKeys.length, 2)
      assert.equal(result.requiredSigners, 2)
    })

    it('should catch and throw errors', async () => {
      try {
        await uut.createMultisigWallet()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Cannot read')
      }
    })
  })

  describe('#getPublicKeys', () => {
    it('should retrieve the public keys for each NFT holder', async () => {
      // Mock dependencies and force desired code path.
      sandbox.stub(uut.mcCollectKeys, 'getNftsFromGroup').resolves(['fb707a9d8a4d6ba47ef0c510714ca46d4523cd29c8f4e3fd6a63a85edb8b05d2'])
      sandbox.stub(uut.mcCollectKeys, 'getAddrs').resolves(['bitcoincash:qzwahhjldv0qsecfxlmcenzvkjv9rlv9au2hcfggl6'])
      sandbox.stub(uut.mcCollectKeys, 'findKeys').resolves({
        keys: [{
          addr: 'bitcoincash:qzwahhjldv0qsecfxlmcenzvkjv9rlv9au2hcfggl6',
          pubKey: '02055962631b236ddcd2c17cd0b711f12438b93bcf01b206cadb351cc3e6e3e269'
        }],
        keysNotFound: []
      })

      const result = await uut.getPublicKeys()
      // console.log('result: ', result)

      assert.isArray(result)
      assert.equal(result[0].addr, 'bitcoincash:qzwahhjldv0qsecfxlmcenzvkjv9rlv9au2hcfggl6')
      assert.equal(result[0].pubKey, '02055962631b236ddcd2c17cd0b711f12438b93bcf01b206cadb351cc3e6e3e269')
    })

    it('should catch and throw errors', async () => {
      try {
        // Mock dependencies and force desired code path
        sandbox.stub(uut.mcCollectKeys, 'getNftsFromGroup').rejects(new Error('test error'))

        await uut.getPublicKeys()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#validateFlags()', () => {
    it('validateFlags() should return true if name is supplied.', () => {
      assert.equal(uut.validateFlags({ name: 'test' }), true, 'return true')
    })

    it('validateFlags() should throw error if name is not supplied.', () => {
      try {
        uut.validateFlags({})
      } catch (err) {
        assert.include(
          err.message,
          'You must specify a wallet name with the -n flag',
          'Expected error message.'
        )
      }
    })
  })

  describe('#run', () => {
    it('should execute the run function and return true', async () => {
      // Mock dependencies
      sandbox.stub(uut.walletUtil, 'instanceWallet').resolves({
        initialize: async () => {},
        getPsfWritePrice: async () => { return 0.08335233 }
      })
      sandbox.stub(uut, 'validateFlags').resolves()
      sandbox.stub(uut, 'getPublicKeys').resolves()
      sandbox.stub(uut, 'createMultisigWallet').resolves()
      sandbox.stub(uut, 'uploadUpdateObject').resolves()
      sandbox.stub(uut, 'writeCidToBlockchain').resolves()
      sandbox.stub(uut.walletUtil, 'instancePsffpp').resolves({
        createPinClaim: async () => { return { pobTxid: 'fakePobTxid', claimTxid: 'fakeClaimTxid' } }
      })

      const flags = {
        name: 'test123'
      }

      const result = await uut.run(flags)
      assert.equal(result, true)
    })
  })
})
