const assert = require('assert')
const unhandledErrorListener = require('./unhandledErrorListener')

describe('unhandledErrorListener', () => {
  it('Exits the process on error if this is the only listener for the error event.', async () => {
    const mockEmitter = {
      listenerCount() {
        return 1
      },
      listeners() {
        return [unhandledErrorListener]
      }
    }
    const originalProcessExit = process.exit
    const originalConsoleError = console.error
    let processExitCalledWithExitCode = null
    process.exit = exitCode => {
      processExitCalledWithExitCode = exitCode
    }
    console.error = () => {}
    unhandledErrorListener.call(mockEmitter, new Error('test'))
    assert.equal(processExitCalledWithExitCode, 1)
    process.exit = originalProcessExit
    console.error = originalConsoleError
  })

  it('Noops if there are other error event listeners', async () => {
    const mockListener = () => {}

    const mockEmitter = {
      listenerCount() {
        return 2
      },
      listeners() {
        return [unhandledErrorListener, mockListener]
      }
    }

    unhandledErrorListener.call(mockEmitter, new Error('test'))
    // no error
  })

})
