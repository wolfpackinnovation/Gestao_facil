const { payload: pixPayload } = require('pix-payload');

// Generate using the library
const libPayload = pixPayload({
  key: '12345678901',
  name: 'DOCES DA MARI',
  city: 'SAO PAULO',
  amount: 50.00,
  transactionId: '***',
})
console.log('Lib payload:', libPayload)

// My payload
function pad(len) { return len.toString().padStart(2, '0') }
function emv(id, value) { return `${id}${pad(value.length)}${value}` }
function removeAccents(str) { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') }
function projectName(name) { return removeAccents(name).replace(/[^A-Za-z0-9 ]/g, '').trim().substring(0, 25).toUpperCase() }
function projectCity(city) { return removeAccents(city).replace(/[^A-Za-z0-9 ]/g, '').trim().substring(0, 15).toUpperCase() }
function projectTxid(txid) { return txid.replace(/[^A-Za-z0-9]/g, '').substring(0, 25).toUpperCase() || '***' }
function crc16(data) {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021
      else crc <<= 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}
function build(params) {
  const receiverName = projectName(params.merchantName || 'RECEBEDOR')
  const receiverCity = projectCity(params.merchantCity || 'BRASIL')
  const txid = projectTxid(params.txid || '***')
  const merchantAccount = emv('26', emv('00', 'br.gov.bcb.pix') + emv('01', params.pixKey))
  const additionalData = emv('62', emv('05', txid))
  const parts = [emv('00', '01'), merchantAccount, emv('52', '0000'), emv('53', '986')]
  if (params.amount > 0) parts.push(emv('54', params.amount.toFixed(2)))
  parts.push(emv('58', 'BR'), emv('59', receiverName), emv('60', receiverCity), additionalData, '6304')
  return parts.join('') + crc16(parts.join(''))
}

const myPayload = build({
  pixKey: '12345678901',
  merchantName: 'DOCES DA MARI',
  merchantCity: 'SAO PAULO',
  amount: 50.00,
  txid: '***',
})
console.log('My payload:', myPayload)
console.log('Lengths - lib:', libPayload.length, 'mine:', myPayload.length)
console.log('Lib CRC:', libPayload.slice(-4))
console.log('My CRC:', myPayload.slice(-4))
