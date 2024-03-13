import { OAuth2Client } from 'google-auth-library';
import GmailApiAdapter from '../../Infrastructure/api/GmailApiAdapter';
import TransactionDate from '../../Domain/ValueObject/TransactionDate';
import WithdrawalAmount from '../../Domain/ValueObject/WithdrawalAmount';
import Transaction from '../../Domain/Model/Transaction';
import ITransactionRepository from '../../Domain/Interfaces/ITransactionRepository';
import dotenv from 'dotenv';
dotenv.config();
class EmailTransactionService {
  private readonly _oauth2Client: OAuth2Client;
  private readonly _repository: ITransactionRepository;

  constructor(oauth2Client: OAuth2Client, repository: ITransactionRepository) {
    this._oauth2Client = oauth2Client;
    this._repository = repository;
  }
  
  private _buildTransactionDate(date: Date): TransactionDate {
    return new TransactionDate(date);
  }
  private _buildWithdrawalAmount(snippet: string ): WithdrawalAmount {
    const amount = this._extractAmount(snippet);
    return new WithdrawalAmount(Number(amount));
  }
  private _buildTransaction(date:string, snippet:string): Transaction {
    const transactionDate = this._buildTransactionDate(new Date(date));
    const withdrawalAmount = this._buildWithdrawalAmount(snippet);
    return new Transaction(transactionDate, withdrawalAmount);
  }

  public async fetchTransactions(query: string) {
    const gmailApiAdapter = new GmailApiAdapter(this._oauth2Client, query);
    const response = await gmailApiAdapter.getMessageIds();
    const messageIds = response.data.messages;
    if (messageIds === undefined) return;

    for (const messageId of messageIds) {
      const res = await gmailApiAdapter.getMessage(String(messageId.id));
      const data = res.data;

      // TODO:messageresponseの型を作成
      const transaction = this._buildTransaction(String(data.internalDate), String(data.snippet));

      // 保存処理
      await this._repository.save(transaction);
      console.log(transaction.value());

      // メールにラベルを付与
      await gmailApiAdapter.addLabelToMessage(
        String(messageId.id),
        'Label_3417572379770606098'
      );
    }
    // 今月の取引を取得
    const nowYear = new Date().getFullYear();
    const nowMonth = new Date().getMonth();
    const startDate = new TransactionDate(new Date(nowYear, nowMonth, 1));
    const endDate = new TransactionDate(new Date(nowYear, nowMonth + 1, 0));

    const transactions = await this._repository.findByDateRange(
      startDate,
      endDate
    );

    // 昨日の取引を取得
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = new TransactionDate(yesterday);
    const yesterdayTransactions = await this._repository.findByDateRange(
      yesterdayDate,
      yesterdayDate
    );

    // 今月の総額を作成
    let totalAmount = 0;
    transactions.forEach((transaction) => {
      totalAmount += transaction.value().amount.value();
    });

    // 昨日の総額を作成
    let yesterdayTotalAmount = 0;
    yesterdayTransactions.forEach((transaction) => {
      yesterdayTotalAmount += transaction.value().amount.value();
    });

    console.log('今月の取引', transactions);
    console.log('今月の総額', totalAmount);
    console.log('昨日の取引', yesterdayTransactions);
    console.log('昨日の総額', yesterdayTotalAmount);

    console.log(transactions);

    let totalAmountHtml = `<table style="width: 90%; border-collapse: collapse;">
                        <tr style="background-color: #4CAF50; color: white;">
                          <th style="padding: 8px; border: 1px solid #ddd;">Date</th>
                          <th style="padding: 8px; border: 1px solid #ddd;">Amount</th>
                        </tr>`;

    transactions.forEach((transaction) => {
      let amountValue = transaction.value().amount.value();
      let color = amountValue <= 0 ? '#4CAF50' : '#F44336'; // 緑色でプラス、赤色でマイナス
      totalAmountHtml += `<tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">${transaction
                          .value()
                          .date.value()}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; color: ${color};">${amountValue}</td>
                      </tr>`;
    });

    totalAmountHtml += `</table>`;

    totalAmountHtml += '</table>';

    // メールを送信
    const messageBody = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transaction Summary</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; color: #333;">
  <div style="background-color: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #4CAF50;">取引概要</h2>
    <p style="margin-bottom: 10px;"><strong>昨日との差額：</strong><span style="color: #555;">${
      totalAmount - yesterdayTotalAmount
    } + ${yesterdayTotalAmount} = ${totalAmount}</span></p>
    <p style="margin-bottom: 10px;"><strong>今月の取引：</strong><span style="color: #555;">${
      transactions.length
    }件</span></p>
    <p style="margin-bottom: 10px;"><strong>今月の総額：</strong><span style="color: #555;">${totalAmount}円</span></p>
    <p style="margin-bottom: 10px;"><strong>昨日の取引：</strong><span style="color: #555;">${
      yesterdayTransactions.length
    }件</span></p>
    <p><strong>昨日の総額：</strong><span style="color: #555;">${yesterdayTotalAmount}円</span></p>
    ${totalAmountHtml}
  </div>
  </body></html>`;

    const raw = {
      to: process.env.EMAIL_RECIPIENT,
      from: 'me',
      subject: '本日の取引概要',
      message: messageBody,
    };
    await gmailApiAdapter.sendMessage(raw);
  }

  private _extractAmount(text: string): string | null {
    const pattern = /口座引落分：(\d+)円/;
    const matches = text.match(pattern);

    return matches ? matches[1] : null;
  }
}

export default EmailTransactionService;
