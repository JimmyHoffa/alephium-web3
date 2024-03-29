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

import { Buffer } from 'buffer/'
import bs58 from './bs58'
import { binToHex, isHexString } from './utils'
import * as api from '../api/api-alephium'

const bigIntZero = BigInt(0)

class UnSigned {
  static readonly oneByteBound = BigInt(0x40)
  static readonly twoByteBound = UnSigned.oneByteBound << BigInt(8)
  static readonly fourByteBound = UnSigned.oneByteBound << BigInt(8 * 3)
  static readonly u256UpperBound = BigInt(1) << BigInt(256)
}

class Signed {
  static readonly oneByteBound = BigInt(0x20)
  static readonly twoByteBound = Signed.oneByteBound << BigInt(8)
  static readonly fourByteBound = Signed.oneByteBound << BigInt(8 * 3)
  static readonly i256UpperBound = BigInt(1) << BigInt(255)
  static readonly i256LowerBound = -this.i256UpperBound
}

class CompactInt {
  static readonly oneBytePrefix = 0x00
  static readonly oneByteNegPrefix = 0xc0
  static readonly twoBytePrefix = 0x40
  static readonly twoByteNegPrefix = 0x80
  static readonly fourBytePrefix = 0x80
  static readonly fourByteNegPrefix = 0x40
  static readonly multiBytePrefix = 0xc0
}

export function encodeBool(bool: boolean): Uint8Array {
  return bool ? Uint8Array.from([1]) : Uint8Array.from([0])
}

export function encodeI256(i256: bigint): Uint8Array {
  if (i256 >= bigIntZero) {
    return encodeI256Positive(i256)
  } else {
    return encodeI256Negative(i256)
  }
}

// n should be positive
function toByteArray(n: bigint, signed: boolean, notBit: boolean): Uint8Array {
  let hex = n.toString(16)
  if (hex.length % 2 === 1) {
    hex = '0' + hex
  } else if (signed && hex[0] >= '8') {
    hex = '00' + hex // add the byte for sign
  }

  const byteLength = hex.length / 2
  const bytes = new Uint8Array(byteLength + 1)
  for (let index = 0; index < byteLength; index++) {
    const offset = index * 2
    const byte = parseInt(hex.slice(offset, offset + 2), 16)
    bytes[`${index + 1}`] = notBit ? ~byte : byte
  }

  const header = byteLength - 4 + CompactInt.multiBytePrefix
  bytes[0] = header
  return bytes
}

function encodeI256Positive(i256: bigint): Uint8Array {
  if (i256 < Signed.oneByteBound) {
    return new Uint8Array([Number(i256) + CompactInt.oneBytePrefix])
  } else if (i256 < Signed.twoByteBound) {
    const num = Number(i256)
    return new Uint8Array([(num >> 8) + CompactInt.twoBytePrefix, num & 0xff])
  } else if (i256 < Signed.fourByteBound) {
    const num = Number(i256)
    return new Uint8Array([(num >> 24) + CompactInt.fourBytePrefix, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff])
  } else if (i256 < Signed.i256UpperBound) {
    return toByteArray(i256, true, false)
  } else {
    throw Error(`Too large number for i256: ${i256}`)
  }
}

function encodeI256Negative(i256: bigint): Uint8Array {
  if (i256 >= -Signed.oneByteBound) {
    const num = Number(i256)
    return new Uint8Array([(num ^ CompactInt.oneByteNegPrefix) & 0xff])
  } else if (i256 >= -Signed.twoByteBound) {
    const num = Number(i256)
    return new Uint8Array([((num >> 8) ^ CompactInt.twoByteNegPrefix) & 0xff, num & 0xff])
  } else if (i256 >= -Signed.fourByteBound) {
    const num = Number(i256)
    return new Uint8Array([
      ((num >> 24) ^ CompactInt.fourByteNegPrefix) & 0xff,
      (num >> 16) & 0xff,
      (num >> 8) & 0xff,
      num & 0xff
    ])
  } else if (i256 >= Signed.i256LowerBound) {
    return toByteArray(~i256, true, true)
  } else {
    throw Error(`Too small number for i256: ${i256}`)
  }
}

export function encodeU256(u256: bigint): Uint8Array {
  if (u256 < bigIntZero) {
    throw Error(`Negative number for U256: ${u256}`)
  } else if (u256 < UnSigned.oneByteBound) {
    return new Uint8Array([Number(u256) + CompactInt.oneBytePrefix])
  } else if (u256 < UnSigned.twoByteBound) {
    const num = Number(u256)
    return new Uint8Array([((num >> 8) & 0xff) + CompactInt.twoBytePrefix, num & 0xff])
  } else if (u256 < UnSigned.fourByteBound) {
    const num = Number(u256)
    return new Uint8Array([
      ((num >> 24) & 0xff) + CompactInt.fourBytePrefix,
      (num >> 16) & 0xff,
      (num >> 8) & 0xff,
      num & 0xff
    ])
  } else if (u256 < UnSigned.u256UpperBound) {
    return toByteArray(u256, false, false)
  } else {
    throw Error(`Too large number for U256: ${u256}`)
  }
}

export function encodeByteVec(bytes: string): Uint8Array {
  if (!isHexString(bytes)) {
    throw Error(`Given value ${bytes} is not a valid hex string`)
  }

  const buffer0 = Buffer.from(bytes, 'hex')
  const buffer1 = encodeI256(BigInt(buffer0.length))
  return Buffer.concat([buffer1, buffer0])
}

export function encodeAddress(address: string): Uint8Array {
  return bs58.decode(address)
}

function invalidTemplateVariable(tpe: string, value: TemplateVariable): Error {
  return Error(`Invalid template value ${value} for type ${tpe}`)
}

enum Instruction {
  trueConst = 3,
  falseConst = 4,
  i256Const0 = 5,
  i256Const1 = 6,
  i256Const2 = 7,
  i256Const3 = 8,
  i256Const4 = 9,
  i256Const5 = 10,
  i256ConstN1 = 11,
  u256Const0 = 12,
  u256Const1 = 13,
  u256Const2 = 14,
  u256Const3 = 15,
  u256Const4 = 16,
  u256Const5 = 17,
  i256Const = 18,
  u256Const = 19,
  bytesConst = 20,
  addressConst = 21
}

// TODO: optimize
function encodeI256Variable(value: bigint): Uint8Array {
  return new Uint8Array([Instruction.i256Const, ...encodeI256(value)])
}

// TODO: optimize
function encodeU256Variable(value: bigint): Uint8Array {
  return new Uint8Array([Instruction.u256Const, ...encodeU256(value)])
}

export function encodeTemplateVariableAsString(tpe: string, value: TemplateVariable): string {
  return Buffer.from(encodeTemplateVariable(tpe, value)).toString('hex')
}

export function encodeTemplateVariable(tpe: string, value: TemplateVariable): Uint8Array {
  switch (tpe) {
    case 'Bool':
      if (typeof value === 'boolean') {
        const byte = value ? Instruction.trueConst : Instruction.falseConst
        return new Uint8Array([byte])
      }
      break
    case 'I256':
      if (typeof value === 'number' && Number.isInteger(value)) {
        return encodeI256Variable(BigInt(value))
      } else if (typeof value === 'bigint') {
        return encodeI256Variable(value)
      }
      break
    case 'U256':
      if (typeof value === 'number' && Number.isInteger(value)) {
        return encodeU256Variable(BigInt(value))
      } else if (typeof value === 'bigint') {
        return encodeU256Variable(value)
      }
      break
    case 'ByteVec':
      if (typeof value === 'string') {
        return new Uint8Array([Instruction.bytesConst, ...encodeByteVec(value)])
      }
      break
    case 'Address':
      if (typeof value === 'string') {
        return new Uint8Array([Instruction.addressConst, ...encodeAddress(value)])
      }
      break
  }

  throw invalidTemplateVariable(tpe, value)
}

const templateVariableRegex = /\{([a-z][a-zA-Z0-9]*):([A-Z][a-zA-Z0-9]*)\}/g
type TemplateVariable = boolean | number | bigint | string
export type TemplateVariables = Record<string, TemplateVariable>

export function buildByteCode(templateByteCode: string, templateVariables: TemplateVariables): string {
  return templateByteCode.replace(templateVariableRegex, (_, p1, p2) => {
    const variableName = p1
    const variableType = p2
    if (variableName in templateVariables) {
      const variableValue = templateVariables[`${variableName}`]
      return encodeTemplateVariableAsString(variableType, variableValue)
    } else {
      throw new Error(`The value of variable ${variableName} is not provided`)
    }
  })
}

export function buildContractByteCode(
  compiled: api.TemplateContractByteCode,
  templateVariables: TemplateVariables
): string {
  const methodsBuilt = compiled.methodsByteCode.map((template) => buildByteCode(template, templateVariables))
  let count = 0
  const methodIndexes = methodsBuilt.map((hex) => {
    count += hex.length / 2
    return count
  })
  return (
    binToHex(encodeI256(BigInt(compiled.filedLength))) +
    binToHex(encodeI256(BigInt(methodIndexes.length))) +
    methodIndexes.map((index) => binToHex(encodeI256(BigInt(index)))).join('') +
    methodsBuilt.join('')
  )
}
