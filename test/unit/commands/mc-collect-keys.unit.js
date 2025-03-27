/*
  Unit tests for the mc-collect-keys command.
*/

// Global npm libraries
import { assert } from 'chai'
import sinon from 'sinon'
import { promises as fs } from 'fs'

// Local libraries
import MCCollectKeys from '../../../src/commands/mc-collect-keys.js'
import WalletCreate from '../../../src/commands/wallet-create.js'
import BchWalletMock from '../../mocks/msw-mock.js'
import WalletServiceMock from '../../mocks/wallet-service-mock.js'
const walletCreate = new WalletCreate()

const __dirname = import.meta.dirname
const filename = `${__dirname.toString()}/../../../.wallets/test123.json`

describe('#mc-collect-keys', () => {
  let uut
  let sandbox
  // let mockWallet

  before(async () => {
    await walletCreate.createWallet(filename)
  })

  beforeEach(async () => {
    sandbox = sinon.createSandbox()

    uut = new MCCollectKeys()
    // mockWallet = new MockWallet()
  })

  afterEach(() => {
    sandbox.restore()
  })

  after(async () => {
    await fs.rm(filename)
  })

  describe('#getNftsFromGroup', () => {
    it('should get NFT token IDs from a Group token', async () => {
      uut.bchWallet = new BchWalletMock()

      // Mock dependencies and force desired code path
      sandbox.stub(uut.bchWallet, 'getTokenData').resolves({
        genesisData: {
          nfts: ['a', 'b', 'c']
        }
      })

      const result = await uut.getNftsFromGroup('fake-group-id')

      assert.isArray(result)
    })

    it('should catch and throw errors', async () => {
      try {
        uut.bchWallet = new BchWalletMock()

        // Mock dependencies and force desired code path
        sandbox.stub(uut.bchWallet, 'getTokenData').rejects(new Error('test error'))

        await uut.getNftsFromGroup()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#getAddrs', () => {
    it('should should return addresses associated with each NFT', async () => {
      uut.bchWallet = new BchWalletMock()

      // Mock dependencies and force desired code path.
      sandbox.stub(uut.bchWallet, 'getTokenData').resolves({
        genesisData: {
          nftHolder: 'sam'
        }
      })

      const nfts = ['a']

      const result = await uut.getAddrs(nfts)

      assert.isArray(result)
      assert.equal(result[0], 'sam')
    })

    it('should catch and throw errors', async () => {
      try {
        await uut.getAddrs()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Cannot read')
      }
    })
  })

  describe('#findKeys', () => {
    it('should collect public keys for an addresses', async () => {
      uut.bchWallet = new BchWalletMock()

      const addrs = ['bitcoincash:qzwahhjldv0qsecfxlmcenzvkjv9rlv9au2hcfggl6']
      const nfts = ['fb707a9d8a4d6ba47ef0c510714ca46d4523cd29c8f4e3fd6a63a85edb8b05d2']

      // Mock dependencies and force desired code path.
      sandbox.stub(uut.bchWallet, 'getPubKey').resolves('02055962631b236ddcd2c17cd0b711f12438b93bcf01b206cadb351cc3e6e3e269')

      const result = await uut.findKeys(addrs, nfts)
      // console.log('result: ', result)

      // Assert expected properties exist
      assert.property(result, 'keys')
      assert.property(result, 'keysNotFound')

      // Assert that each property is an array.
      assert.isArray(result.keys)
      assert.isArray(result.keysNotFound)

      // Assert expected values exist
      assert.equal(result.keys[0].addr, 'bitcoincash:qzwahhjldv0qsecfxlmcenzvkjv9rlv9au2hcfggl6')
      assert.equal(result.keys[0].pubKey, '02055962631b236ddcd2c17cd0b711f12438b93bcf01b206cadb351cc3e6e3e269')
    })

    it('should handle address without a public key', async () => {
      uut.bchWallet = new BchWalletMock()

      const addrs = ['bitcoincash:qzwahhjldv0qsecfxlmcenzvkjv9rlv9au2hcfggl6']
      const nfts = ['fb707a9d8a4d6ba47ef0c510714ca46d4523cd29c8f4e3fd6a63a85edb8b05d2']

      // Mock dependencies and force desired code path.
      sandbox.stub(uut.bchWallet, 'getPubKey').resolves('not found')

      const result = await uut.findKeys(addrs, nfts)
      // console.log('result: ', result)

      // Assert expected properties exist
      assert.property(result, 'keys')
      assert.property(result, 'keysNotFound')

      // Assert that each property is an array.
      assert.isArray(result.keys)
      assert.isArray(result.keysNotFound)

      // Assert expected values exist
      assert.equal(result.keysNotFound[0], 'bitcoincash:qzwahhjldv0qsecfxlmcenzvkjv9rlv9au2hcfggl6')
    })

    it('should catch and throw errors', async () => {
      try {
        await uut.findKeys()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Cannot read')
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
    it('should execute the run function', async () => {
      // Mock dependencies
      sandbox.stub(uut.walletUtil, 'instanceWallet').resolves(new BchWalletMock())
      sandbox.stub(uut, 'getNftsFromGroup').resolves({})
      sandbox.stub(uut, 'getAddrs').resolves({})
      sandbox.stub(uut, 'findKeys').resolves({})

      const flags = {
        name: 'test123'
      }

      const result = await uut.run(flags)

      assert.equal(result, true)
    })

    it('should handle an error without a message', async () => {
      const result = await uut.run()

      assert.equal(result, 0)
    })
  })
})
