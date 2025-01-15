# Muon DVN

It's a interface to the LayerZero DVN that is responsible to verify packet integrity across multiple chains. In use.
It has three main components that are described below.

## Components
- ### DVN contract
  Should be implemented and deployed on every chain we want to support.
  
  | Function Name | Description |
  | --- | --- |
  | assignJob | Called by LayerZero to assign a job to the DVN. |
  | getFee | Typically called by applications before sending the packet to estimate fees. |
  | verify | Called by off-chain component to verify the packet on destination chain. |

- ### Off-chain component
  Workflow:<br/>
  1. It'll listen for the `JobAssigned` event on the source chain.
  2. Get signature from the muon app.
  3. Call the DVN contract's verify function to verify the packet.

- ### Muon app
  It decodes packet sent on the source chain and verifies payload hash and then generate the signature to use in the contract on the destination chain.
