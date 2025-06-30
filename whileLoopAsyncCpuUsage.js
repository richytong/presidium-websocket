const os = require('os')
const sleep = require('./_internal/sleep')

/**
 * @name calculateCpuUsage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * type CPU = {
 *   model: string,
 *   speed: number,
 *   times: {
 *     user: number,
 *     nice: number,
 *     sys: number,
 *     idle: number,
 *     irq: number,
 *   },
 * }
 *
 * calculateCpuUsage({
 *   cpus: Array<CPU>,
 *   prevCpus: Array<CPU>,
 * }) -> cpuUsage number
 * ```
 */
const calculateCpuUsage = function (options) {
  const { cpus, prevCpus } = options
  const cpuTimeDifferences =
    { total: 0, user: 0, nice: 0, sys: 0, idle: 0, irq: 0 }
  let index = -1
  while (++index < cpus.length) {
    const cpu = cpus[index]
    const prevCpu = prevCpus[index]
    for (const mode in cpu.times) {
      const timeDifference = cpu.times[mode] - prevCpu.times[mode]
      cpuTimeDifferences[mode] += timeDifference
      cpuTimeDifferences.total += timeDifference
    }
  }
  if (cpuTimeDifferences.total == 0) {
    return 0
  }
  return 1 - (cpuTimeDifferences.idle / cpuTimeDifferences.total)
}

setImmediate(async () => {
  let prevCpus = os.cpus()
  while (true) {
    const cpus = os.cpus()
    const cpuUsage = calculateCpuUsage({ cpus, prevCpus })
    console.log(cpuUsage)
    prevCpus = cpus
    await sleep(500)
  }
})

  /*
setImmediate(async () => {
  while (true) {
    await sleep(0)
  }
})

setImmediate(async () => {
  while (true) {
    await sleep(0)
  }
})
*/

module.exports = calculateCpuUsage

