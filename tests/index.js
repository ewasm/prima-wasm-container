const tape = require('tape')
const fs = require('fs')
const Hypervisor = require('primea-hypervisor')
const Message = require('primea-message')
const WasmContainer = require('../index.js')
const testInterface = require('./testInterface.js')
const IPFS = require('ipfs')

const node = new IPFS({
  start: false
})

class ContainerTestInterface {
  constructor (wasmContainer) {
    this.wasmContainer = wasmContainer
  }

  readMem (offset) {
    return this.wasmContainer.getMemory(offset, 1)
  }

  writeMem (offset, val) {
    return this.wasmContainer.setMemory(offset, [val])
  }

  async callback (cb) {
    const promise = new Promise((resolve, reject) => {
      resolve()
    })
    await this.wasmContainer.pushOpsQueue(promise)
    this.wasmContainer.execute(cb)
  }
}

node.on('ready', () => {
  tape('wasm container - main', async t => {
    t.plan(1)
    const hypervisor = new Hypervisor(node.dag)
    const main = fs.readFileSync(`${__dirname}/wasm/run.wasm`)
    hypervisor.registerContainer(WasmContainer, {
      test: testInterface(t)
    })
    const instance = await hypervisor.createInstance(WasmContainer.typeId, new Message({
      data: main
    }))
    instance.message(instance.createMessage())
  })

  tape('wasm container - mem', async t => {
    t.plan(1)
    try {
      const hypervisor = new Hypervisor(node.dag)
      const readMem = fs.readFileSync(`${__dirname}/wasm/readMem.wasm`)
      hypervisor.registerContainer(WasmContainer, {
        env: ContainerTestInterface,
        test: testInterface(t)
      })
      await hypervisor.createInstance(WasmContainer.typeId, new Message({
        data: readMem
      }))
    } catch (e) {
      console.log(e)
    }
  })

  tape('write mem', async t => {
    // t.plan(1)
    try {
      const hypervisor = new Hypervisor(node.dag)
      const readMem = fs.readFileSync(`${__dirname}/wasm/writeMem.wasm`)
      hypervisor.registerContainer(WasmContainer, {
        env: ContainerTestInterface,
        test: testInterface(t)
      })
      const root = await hypervisor.createInstance(WasmContainer.typeId, new Message({
        data: readMem
      }))
      const mem = root.container.getMemory(0, 1)
      t.equals(mem[0], 9)
      t.end()
      
    } catch (e) {
      console.log(e)
    }
  })

  tape('wasm container - callbacks', async t => {
    t.plan(1)
    const hypervisor = new Hypervisor(node.dag)
    const callBackWasm = fs.readFileSync(`${__dirname}/wasm/callback.wasm`)
    hypervisor.registerContainer(WasmContainer, {
      env: ContainerTestInterface,
      test: testInterface(t)
    })
    hypervisor.createInstance(WasmContainer.typeId, new Message({
      data: callBackWasm
    }))
  })

  tape('wasm container - invalid', async t => {
    t.plan(1)
    const hypervisor = new Hypervisor(node.dag)
    hypervisor.registerContainer(WasmContainer, {
      env: ContainerTestInterface,
      test: testInterface(t)
    })

    const message = new Message({
      data: Buffer.from([0x00])
    })

    const rp = message.responsePort = {destPort: {messages: []}}

    await hypervisor.createInstance(WasmContainer.typeId, message)
    t.equals(rp.destPort.messages[0].data.exception, true)
  })

  tape('initailize', async t => {
    t.plan(2)

    const callBackWasm = fs.readFileSync(`${__dirname}/wasm/callback.wasm`)

    class ContainerTestInterface {
      constructor (wasmContainer) {
        this.wasmContainer = wasmContainer
      }

      readMem (offset) {
        return this.wasmContainer.getMemory(offset, 1)
      }

      async callback (cb) {
        const promise = new Promise((resolve, reject) => {
          resolve()
        })
        await this.wasmContainer.pushOpsQueue(promise)
        this.wasmContainer.execute(cb)
      }

      static initialize (code) {
        t.equals(code, callBackWasm)
        return code
      }
    }

    const hypervisor = new Hypervisor(node.dag)
    hypervisor.registerContainer(WasmContainer, {
      env: ContainerTestInterface,
      test: testInterface(t)
    })

    const message = new Message({
      data: callBackWasm
    })

    hypervisor.createInstance(WasmContainer.typeId, message)
  })
})
