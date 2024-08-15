'use client'

import { useEthereum } from '../components/Context'

import { Connect } from '../components/Connect'
import { Account } from '../components/Account'
import { NetworkSwitcher } from '../components/NetworkSwitcher'
import { WriteContract } from '../components/WriteContract'

export default function Page() {
  const { account } = useEthereum();
  
  return (
    <div>
      <h1>zkSync + ethers v5 + Next.js</h1>

      <Connect />

      {account.isConnected && (
        <>
          <hr />
          <h2>Network</h2>
          <p>
            <strong>Make sure to connect your wallet to zkSync Testnet for full functionality</strong>
            <br />
          </p>
          <NetworkSwitcher />
          <br />
        
          Account : <Account /> 
          <br />
          <hr />
          <h2>Write Contract</h2>
          <WriteContract />
          <br />
        </>
      )}
    </div>
  )
}
