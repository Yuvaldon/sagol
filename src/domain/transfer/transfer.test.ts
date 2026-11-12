import { SoldierId } from '@contracts'
import { describe, expect, it } from 'vitest'
import { parseCsv, readPastedSoldiers, readSoldierCsv, soldierCsvInput } from '.'

// Sample data, test files only.

describe('parseCsv', () => {
  it('reads quoted cells, doubled quotes, CRLF, a byte order mark and skips blank lines', () => {
    expect(parseCsv('﻿a,"b, c","say ""hi"""\r\n\r\n1,,3\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '', '3'],
    ])
  })

  it('keeps a line break inside quotes, and a last line without one', () => {
    expect(parseCsv('a,"x\ny"\n1,2')).toEqual([
      ['a', 'x\ny'],
      ['1', '2'],
    ])
  })

  it('is null for a quote left open', () => {
    expect(parseCsv('a,"b\n1,2')).toBeNull()
  })

  it('is null for text after a closing quote', () => {
    expect(parseCsv('"a"b,c')).toBeNull()
    expect(parseCsv('"a",b\n"c"\n')).toEqual([['a', 'b'], ['c']])
  })
})

describe('readSoldierCsv', () => {
  it('reads the columns in any order, blanks as NULL, and the left-out ones as NULL', () => {
    expect(readSoldierCsv('last_name,first_name,phone\nכהן,נועה, \nלוי,דן,050-1234567')).toEqual({
      ok: true,
      rows: [
        { first_name: 'נועה', last_name: 'כהן', nickname: null, personal_id: null, phone: null, invite_email: null },
        { first_name: 'דן', last_name: 'לוי', nickname: null, personal_id: null, phone: '050-1234567', invite_email: null },
      ],
    })
  })

  it('reads names without case, and leaves out empty header cells at the end', () => {
    const read = readSoldierCsv('First_Name,LAST_NAME,,\nנועה,כהן,,')
    expect(read.ok && read.rows[0]?.first_name).toBe('נועה')
    expect(readSoldierCsv('first_name,last_name,\nנועה,כהן,סמל')).toEqual({ ok: false, problem: { kind: 'row_length', row: 1 } })
  })

  it('names the problem of a file it cannot use', () => {
    expect(readSoldierCsv('first_name,last_name\n\uFFFD,b')).toEqual({ ok: false, problem: { kind: 'not_utf8' } })
    expect(readSoldierCsv('first_name,last_name\n')).toEqual({ ok: false, problem: { kind: 'empty' } })
    expect(readSoldierCsv('first_name,rank\na,b')).toEqual({ ok: false, problem: { kind: 'unknown_column', column: 'rank' } })
    expect(readSoldierCsv('first_name,phone\na,b')).toEqual({ ok: false, problem: { kind: 'missing_column', column: 'last_name' } })
    expect(readSoldierCsv('first_name,last_name,first_name\na,b,c')).toEqual({
      ok: false,
      problem: { kind: 'repeated_column', column: 'first_name' },
    })
    expect(readSoldierCsv('first_name,last_name\na,b\nc')).toEqual({ ok: false, problem: { kind: 'row_length', row: 2 } })
    expect(readSoldierCsv('first_name,"last_name\na,b')).toEqual({ ok: false, problem: { kind: 'unreadable' } })
  })
})

describe('soldierCsvInput', () => {
  const id = SoldierId.parse('00000000-0000-4000-8000-000000000001')
  const row = { first_name: 'נועה', last_name: 'כהן', nickname: null, personal_id: null, phone: null, invite_email: null }

  it('is a new active soldier, unplaced, without private fields when none are given', () => {
    expect(soldierCsvInput(row, id)).toEqual({
      id,
      first_name: 'נועה',
      last_name: 'כהן',
      nickname: null,
      command_rank_id: null,
      status: 'active',
      properties: {},
      private: null,
      membership: null,
    })
  })

  it('carries the private fields together', () => {
    expect(soldierCsvInput({ ...row, personal_id: '1234567' }, id).private).toEqual({
      personal_id: '1234567',
      invite_email: null,
      phone: null,
    })
  })
})

describe('readPastedSoldiers', () => {
  const labels = {
    first_name: 'First',
    last_name: 'Last',
    nickname: 'Nick',
    personal_id: 'Number',
    phone: 'Phone',
    invite_email: 'Email',
  } as const
  const row = (first_name: string, last_name: string, more: Partial<Record<string, string>> = {}) => ({
    first_name,
    last_name,
    nickname: null,
    personal_id: null,
    phone: null,
    invite_email: null,
    ...more,
  })

  it('splits a spreadsheet copy on tabs, in the grid order, skipping blank lines', () => {
    expect(readPastedSoldiers('Dana\tLevi\t\t123\n\nNoa\tCohen, Jr\n', labels)).toEqual({
      ok: true,
      rows: [row('Dana', 'Levi', { personal_id: '123' }), row('Noa', 'Cohen, Jr')],
    })
  })

  it('splits on commas with CSV quotes when no line has a tab', () => {
    expect(readPastedSoldiers('"Levi, D",Dana', labels)).toEqual({ ok: true, rows: [row('Levi, D', 'Dana')] })
  })

  it('takes the column order from a header of CSV names or grid labels', () => {
    expect(readPastedSoldiers('last,first_name\nLevi,Dana', { ...labels, last_name: 'last' })).toEqual({
      ok: true,
      rows: [row('Dana', 'Levi')],
    })
    expect(readPastedSoldiers('Number\tFirst\n7\tDana', labels)).toEqual({
      ok: true,
      rows: [{ ...row('Dana', ''), last_name: null, personal_id: '7' }],
    })
  })

  it('refuses a cell past the last column and an open quote', () => {
    expect(readPastedSoldiers('a,b,c,d,e,f,g', labels)).toEqual({ ok: false, problem: { kind: 'row_length', row: 1 } })
    expect(readPastedSoldiers('"a,b', labels)).toEqual({ ok: false, problem: { kind: 'unreadable' } })
  })
})
