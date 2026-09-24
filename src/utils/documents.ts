export function normalizeTaxId (value: string): string {
  return value.replaceAll(/[^0-9a-z]/gi, '').toUpperCase()
}

function isValidCpf (cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false
  }

  const digit = (length: number): number => {
    let sum = 0

    for (let index = 0; index < length; index++) {
      sum += Number(cpf[index]) * (length + 1 - index)
    }

    const rest = (sum * 10) % 11

    return rest === 10 ? 0 : rest
  }

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

function isValidCnpj (cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) {
    return false
  }

  const digit = (length: number): number => {
    let sum = 0
    let weight = length - 7

    for (let index = 0; index < length; index++) {
      sum += ((cnpj.codePointAt(index) ?? 48) - 48) * weight
      weight = weight === 2 ? 9 : weight - 1
    }

    const rest = sum % 11

    return rest < 2 ? 0 : 11 - rest
  }

  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13])
}

export function isValidTaxId (value: string): boolean {
  const normalized = normalizeTaxId(value)

  return normalized.length === 11 ? isValidCpf(normalized) : isValidCnpj(normalized)
}

export function formatTaxId (value: string): string {
  const normalized = normalizeTaxId(value)

  if (/^\d{11}$/.test(normalized)) {
    return normalized.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }

  if (/^[0-9A-Z]{12}\d{2}$/.test(normalized)) {
    return normalized.replace(/^(.{2})(.{3})(.{3})(.{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }

  return value
}

export function zipcodeDigits (value: string): string {
  return value.replaceAll(/\D/g, '')
}

export function formatZipcode (value: string | null | undefined): string {
  const digits = zipcodeDigits(value ?? '')

  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : (value ?? '')
}

export function formatPhone (value: string | null | undefined): string {
  const digits = (value ?? '').replaceAll(/\D/g, '')

  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  }

  if (digits.length === 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  }

  return value ?? ''
}
