class TransactionDate {
  private readonly _date: string;

  constructor(date: string | Date) {
    if (date === '') {
      throw new Error('日付が空です');
    }
    if(date instanceof Date) {
      this._date = date.toLocaleString('ja-JP');
      return;
    }
    this._date = new Date(Number(date)).toLocaleString('ja-JP');
  }

  public value(): string {
    return this._date;
  }
}

export default TransactionDate;