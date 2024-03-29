/*
Copyright 2018 - 2022 The Alephium Authors
This file is part of the alephium project.

The library is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

The library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with the library. If not, see <http://www.gnu.org/licenses/>.
*/

import { CliqueClient } from '../src/clique'
import { NodeSigner } from '../src/signer'
import { Contract, Script, TestContractParams } from '../src/contract'

describe('contract', function () {
  async function testSuite1() {
    const client = new CliqueClient({ baseUrl: 'http://127.0.0.1:22973' })
    await client.init(false)

    const add = await Contract.fromSource(client, 'add.ral')
    const sub = await Contract.fromSource(client, 'sub.ral')

    const subState = sub.toState([0], { alphAmount: BigInt('1000000000000000000') })
    const testParams: TestContractParams = {
      initialFields: [0],
      testArgs: [[2, 1]],
      existingContracts: [subState]
    }
    const testResult = await add.testPublicMethod(client, 'add', testParams, { subContractId: subState.contractId })
    expect(testResult.artifactId).toEqual(add.sourceCodeSha256)
    expect(testResult.returns).toEqual([[3, 1]])
    expect(testResult.contracts[0].artifactId).toEqual(sub.sourceCodeSha256)
    expect(testResult.contracts[0].fields).toEqual([1])
    expect(testResult.contracts[1].artifactId).toEqual(add.sourceCodeSha256)
    expect(testResult.contracts[1].fields).toEqual([3])
    const events = testResult.events.sort((a, b) => a.name.localeCompare(b.name))
    expect(events[0].name).toEqual('Add')
    expect(events[0].fields).toEqual([2, 1])
    expect(events[1].name).toEqual('Sub')
    expect(events[1].fields).toEqual([2, 1])

    const testResultPrivate = await add.testPrivateMethod(client, 'addPrivate', testParams, {
      subContractId: subState.contractId
    })
    expect(testResultPrivate.artifactId).toEqual(add.sourceCodeSha256)
    expect(testResultPrivate.returns).toEqual([[3, 1]])

    const signer = await NodeSigner.testSigner(client)

    const subDeployTx = await sub.transactionForDeployment(signer, { initialFields: [0] })
    const subContractId = subDeployTx.contractId
    expect(subDeployTx.group).toEqual(0)
    const subSubmitResult = await signer.submitTransaction(subDeployTx.unsignedTx, subDeployTx.txId)
    expect(subSubmitResult.fromGroup).toEqual(0)
    expect(subSubmitResult.toGroup).toEqual(0)
    expect(subSubmitResult.txId).toEqual(subDeployTx.txId)

    const addDeployTx = await add.transactionForDeployment(signer, {
      initialFields: [0],
      templateVariables: { subContractId: subContractId }
    })
    expect(addDeployTx.group).toEqual(0)
    const addSubmitResult = await signer.submitTransaction(addDeployTx.unsignedTx, addDeployTx.txId)
    expect(addSubmitResult.fromGroup).toEqual(0)
    expect(addSubmitResult.toGroup).toEqual(0)
    expect(addSubmitResult.txId).toEqual(addDeployTx.txId)

    const addContractId = addDeployTx.contractId
    const main = await Script.fromSource(client, 'main.ral')

    const mainScriptTx = await main.transactionForDeployment(signer, {
      templateVariables: { addContractId: addContractId }
    })
    expect(mainScriptTx.group).toEqual(0)
    const mainSubmitResult = await signer.submitTransaction(mainScriptTx.unsignedTx, mainScriptTx.txId)
    expect(mainSubmitResult.fromGroup).toEqual(0)
    expect(mainSubmitResult.toGroup).toEqual(0)
  }

  async function testSuite2() {
    const client = new CliqueClient({ baseUrl: 'http://127.0.0.1:22973' })
    await client.init(false)

    const greeter = await Contract.fromSource(client, 'greeter.ral')

    const testParams: TestContractParams = {
      initialFields: [1]
    }
    const testResult = await greeter.testPublicMethod(client, 'greet', testParams)
    expect(testResult.artifactId).toEqual(greeter.sourceCodeSha256)
    expect(testResult.returns).toEqual([1])
    expect(testResult.contracts[0].artifactId).toEqual(greeter.sourceCodeSha256)
    expect(testResult.contracts[0].fields).toEqual([1])

    const signer = await NodeSigner.testSigner(client)

    const deployTx = await greeter.transactionForDeployment(signer, { initialFields: [1] })
    expect(deployTx.group).toEqual(0)
    const submitResult = await signer.submitTransaction(deployTx.unsignedTx, deployTx.txId)
    expect(submitResult.fromGroup).toEqual(0)
    expect(submitResult.toGroup).toEqual(0)
    expect(submitResult.txId).toEqual(deployTx.txId)

    const greeterContractId = deployTx.contractId
    const main = await Script.fromSource(client, 'greeter_main.ral')

    const mainScriptTx = await main.transactionForDeployment(signer, {
      templateVariables: { greeterContractId: greeterContractId }
    })
    expect(mainScriptTx.group).toEqual(0)
    const mainSubmitResult = await signer.submitTransaction(mainScriptTx.unsignedTx, mainScriptTx.txId)
    expect(mainSubmitResult.fromGroup).toEqual(0)
    expect(mainSubmitResult.toGroup).toEqual(0)
  }

  it('should test contracts', async () => {
    await testSuite1()
    await testSuite2()
  })
})
