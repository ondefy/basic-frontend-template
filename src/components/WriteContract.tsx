'use client'

import { useState } from 'react';
import { Contract, Provider, utils } from "zksync-ethers";
import { useAsync } from '../hooks/useAsync';
import { daiContractConfig } from './contracts'
import { useEthereum } from './Context';
import { getSignature } from "../backend/getSignatureApiCall";
import { BigNumber, ethers } from "ethers";
const abiCoder = new ethers.utils.AbiCoder();

export function WriteContract() {
  const [amount, setAmount] = useState('');
  const { account, getSigner, getProvider, network } = useEthereum();

  const preparePaymasterParam = async (account:any) => {
    const rpcUrl = process.env.ZKSYNC_RPC_URL ?? "https://sepolia.era.zksync.dev";
    const provider = new Provider(rpcUrl);
    // Below part can be managed in getSignature() as well.
    // ------------------------------------------------------------------------------------
    // Note: Do not set maxNonce too high than current to avoid unwanted signature replay.
    // Consider maxNonce is as replayLimit. And setting maxNonce to currentNonce means 0 replay.
    // Get the maxNonce allowed to user. Here we ensure it's currentNonce.
    const maxNonce = BigNumber.from(
      await provider.getTransactionCount(account.address || "") 
    );
    // You can also check for min Nonce from the NonceHolder System contract to fully ensure as ZKsync support arbitrary nonce.
    // -----------------
    const nonceHolderAddress = "0x0000000000000000000000000000000000008003";
    const nonceHolderAbi = [
      "function getMinNonce(address _address) external view returns (uint256)",
    ];
    const nonceHolderContract = new Contract(
      nonceHolderAddress,
      nonceHolderAbi,
      provider
    );
    const maxNonce2 = await nonceHolderContract.callStatic.getMinNonce(
      account.address || ""
    );
    console.log(maxNonce2.toString());
    // -----------------
    // Get the expiration time. Here signature will be valid upto 60 sec.
    const currentTimestamp = BigNumber.from(
      (await provider.getBlock("latest")).timestamp
    );
    const expirationTime = currentTimestamp.add(60);
    // Get the current gas price.
    const maxFeePerGas = await provider.getGasPrice();
    // Set the gasLimit. Here, Dapp would know range of gas a function could cost and add 60K top up for paymaster overhead..
    // Setting 215K (For eg: 150K function gas cost + 65K paymaster overhead)
    // It will refunded anyways, so not an issue if Dapps set more.
    const gasLimit = BigNumber.from(215_000);
    // ------------------------------------------------------------------------------------
    const [paymasterAddress, signature, signerAddress] = await getSignature(
      account.address.toString(),
      daiContractConfig.address.toString(),
      expirationTime,
      maxNonce,
      maxFeePerGas,
      gasLimit
    );
    console.log(signerAddress);
    // We encode the extra data to be sent to paymaster
    // Notice how it's not required to provide from, to, maxFeePerGas and gasLimit as per signature above.
    // That's because paymaster will get it from the transaction struct directly to ensure it's the correct user.
    const innerInput = ethers.utils.arrayify(
      abiCoder.encode(
        ["uint256", "uint256", "address", "bytes"],
        [
          expirationTime, // As used in above signature
          maxNonce, // As used in above signature
          signerAddress, // The signer address
          signature,
        ]
      ) // Signature created in the above snippet. get from API server
    );
    // getPaymasterParams function is available in zksync-ethers
    const paymasterParams = utils.getPaymasterParams(
      paymasterAddress, // Paymaster address
      {
        type: "General",
        innerInput: innerInput,
      }
    );
    return [paymasterParams, maxFeePerGas, gasLimit];
  };
  const { result: transaction, execute: writeContract, inProgress, error } = useAsync(async () => {
    const contract = new Contract(daiContractConfig.address, daiContractConfig.abi, getSigner());

    // random address for testing, replace with contract address that you want to allow to spend your tokens
    const spender = "0xa1cf087DB965Ab02Fb3CFaCe1f5c63935815f044"
    const [paymasterParams, maxFeePerGas, gasLimit] = await preparePaymasterParam(account);

    const tx = await contract.approve(spender, amount,{
      maxFeePerGas,
      gasLimit,
      customData: {
        paymasterParams,
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      }
    });

    waitForReceipt(tx.hash);
    return tx;
  });

  const { result: receipt, execute: waitForReceipt, inProgress: receiptInProgress, error: receiptError } = useAsync(async (transactionHash) => {
    return await getProvider()!.waitForTransaction(transactionHash);
  });

  return (
    <div>
      {network?.unsupported ? (<> Please connect to ZKsync Sepolia Testnet</>) : (<>
      <h3>DAI Approve allowance</h3>
      <form onSubmit={(e) => { e.preventDefault(); !inProgress ? (writeContract()) : {} }}>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          placeholder="allowance amount"
        />
        <button type="submit">Approve</button>
      </form>

      {inProgress && <div>Transaction pending...</div>}
      {transaction && (
        <div>
          <div>Transaction Hash: {transaction?.hash}</div>
          <div>
            Transaction Receipt:
            {receiptInProgress ? (
              <span>pending...</span>
            ) : (
              <pre>{JSON.stringify(receipt, null, 2)}</pre>
            )}
          </div>
        </div>
      )}

      {error && <div>Error: {error?.message}</div>}
      {receiptError && <div>Receipt Error: {receiptError?.message}</div>}
    </>)}
    </div>
    
  );
}
