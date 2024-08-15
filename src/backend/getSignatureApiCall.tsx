import {ethers, BigNumber} from "ethers";
import {Contract, Wallet, Provider} from "zksync-ethers";
import dotenv from "dotenv";
dotenv.config();

export async function getSignature(
  from: string, to: string, expirationTime: BigNumber, maxNonce: BigNumber, maxFeePerGas: BigNumber, gasLimit: BigNumber
){
  const rpcUrl = process.env.ZKSYNC_RPC_URL ?? 'https://sepolia.era.zksync.dev';
  const provider = new Provider(rpcUrl);
  const signer = new Wallet(process.env.NEXT_PUBLIC_SIGNER_PRIVATE_KEY || "", provider);

// EIP-712 domain from the paymaster
const paymasterAddress = "0xc1B0E2edC4cCaB51A764D7Dd8121CBf58C4D9E40";
const paymasterAbi = [
  "function eip712Domain() public view returns (bytes1 fields,string memory name,string memory version,uint256 chainId,address verifyingContract,bytes32 salt,uint256[] memory extensions)",
];

const paymasterContract = new Contract(
  paymasterAddress,
  paymasterAbi,
  provider
);
  const eip712Domain = await paymasterContract.eip712Domain();
  const domain = {
    name: eip712Domain[1],
    version: eip712Domain[2],
    chainId: eip712Domain[3],
    verifyingContract: eip712Domain[4],
  }
  const types = {
    PermissionLessPaymaster: [
      { name: "from", type: "address"},
      { name: "to", type: "address"},
      { name: "expirationTime", type: "uint256"},
      { name: "maxNonce", type: "uint256"},
      { name: "maxFeePerGas", type: "uint256"},
      { name: "gasLimit", type: "uint256"}
    ]
  };
// -------------------- IMPORTANT --------------------
  const values = {
    from,  // User address
    to, // Your dapp contract address which the user will interact
    expirationTime, // Expiration time post which the signature expires
    maxNonce, // Max nonce of user after which signature becomes invalid
    maxFeePerGas, // Current max gas price
    gasLimit // Max gas limit you want to allow to your user. Ensure to add 60K gas for paymaster overhead.
  }
// Note: MaxNonce allows the signature to be replayed.
// For eg: If currentNonce of user is 5, maxNonce is set to 10. Signature will allowed to replayed for nonce 6,7,8,9,10 on the same `to` address by the same user.
// This is to provide flexibility to Dapps to ensure signature works if users have multiple transactions running. 
// Important: Signers are recommended to set maxNonce as current nonce of the user or as close as possible to ensure safety of gas funds.
// Important : Signers should set expirationTime is close enough to ensure safety of funds.

// Signer wallet will already defined in the code
  return [paymasterAddress,(await signer._signTypedData(domain, types, values)), signer.address];
}