# psf-mc-wallet

This is a command-line interface (CLI) forked from [psf-msg-wallet](https://github.com/Permissionless-Software-Foundation/psf-msg-wallet). This fork has all the same commands, but adds additional commands for the [PSF Minting Council](https://psfoundation.info/governance/minting-council) to recieve, review, and issue multisignature approval transactions. These transactions are currently used to set the price to write data to the [PSFFPP](https://psffpp.com), and will be used for other purposes in the future.


## Installation

This software requires node.js v20 or higher. Instructions for installation:

- `git clone https://github.com/Permissionless-Software-Foundation/psf-mc-wallet`
- `cd psf-mc-wallet`
- `npm install`

## Usage

### Display Help

- `node psf-mc-wallet.js help`

-----

### Minting Council Commands

This fork retains all the commands available in [psf-msg-wallet](https://github.com/Permissionless-Software-Foundation/psf-msg-wallet). Check that README for additional commands.

-----
-----

#### Collect Keys

Show the BCH address and public key for all Minting Council NFT holders. This information is used by other commands to send E2EE messages and data between Minting Council members.

##### Arguments
- `-n` - wallet name being used for a price update ceremony

##### Example

- `node psf-mc-wallet.js mc-collect-keys -n janitor-wallet`

-----

#### Update Price

The 'Head Janitor' initiates the price updating ceremony by issuing a Price Update transaction. This command does a couple things:
- Uploads a JSON file to the [PSFFPP network](https://psffpp.com) containing all the information about the desired price update.
- Generates a BCH TX, sent to a specific address, with an OP_RETURN in the first output that points to the pinned file

The Head Janitor should record the TXID generated by this command. They will need it later.

##### Arguments
- `-n` - wallet name being used for a price update ceremony

##### Example
- `node psf-mc-wallet.js mc-price-update -n janitor-wallet`

-----

#### Generate Approval Transaction

This command will execute the following workflow:

- It looks up the public keys for each Minting Council NFT holder.
- Those public keys are used to generate a multisig wallet.
- A multig transaction (TX) is generated which *approves* the Update Transaction.
- The unsigned multisig transaction is sent to each member of the Minting Council via an E2EE message.

##### Arguments
- `-n` - (required) wallet name being used for price update ceremony
- `-t` - (required) The TXID of the Update Transaction (created with the mc-update-price command)
- `-j` - (required) The name of a JSON file in the `files/` directory, containg the message to send to each member of the Minting Council.

#### Example
- `node psf-mc-wallet.js mc-approval -n janitor-wallet -j msg.json -t 1604c864de7f65c29abc19180fb8cfe2a3b0cee686f13fdea17d05cd1844291c`

Example msg.json file:

```json
{
  "message": "This is a test message that would go out to the Minting Council."
}
```
-----

#### Sign Transaction

After verifying the authenticity and accuracy of the Approval transaction, a member of the Minting Council can use this command to sign their input, to signal their approval of the price update. The signature will be sent back to the originator of the Approval transaction message.

##### Arguments
- `-n` - (required) Name of the wallet holding the Minting Council NFT
- `-t` - (required) TXID of message containing Approval transaction

##### Example
- `node psf-mc-wallet.js mc-sign-tx -n nft-holder1 -t fa46533bf07eedd997c733becd627e0a849488fb217dc81bae5fb80b09d03db3`

-----

#### Finalize Price Update

Once enough members of the Minting Council have responded with their signatures, the Head Janitor can sign and broadcast the multisignature Approval transaction with this command.

##### Argument
- `-n` - (required) wallet name being used for price update ceremony
- `-t` - (required) JSON array of TXIDs of messages containing signatures

##### Example:
- `node psf-mc-wallet.js mc-finish -n janitor-wallet -t '["5b3b4ef25601a27f7ddf78f7c9c9c1879ebb86f1c3a02ea835307b8ecdf7faf1", "895f9dc3ccbe47f466e9c9926a85a03b0bab1b9cff33a68436c339b7f18060c7", "fe7d1ceb641eaac911d49a4b5a7a92684419b36cf07504f1f8637b36887005e7"]'`

