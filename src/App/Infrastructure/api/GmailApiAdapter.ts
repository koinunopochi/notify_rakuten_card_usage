// GmailApiAdapter.ts
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

class GmailApiAdapter {
  private readonly _oauth2Client: OAuth2Client;
  private readonly _query: string;
  private readonly _gmail = google.gmail('v1');

  constructor(oauth2Client: OAuth2Client, query: string) {
    this._oauth2Client = oauth2Client;
    this._query = query;
  }

  public async getLabels() {
    return await this._gmail.users.labels.list({
      auth: this._oauth2Client,
      userId: 'me',
    });
  }

  public async getMessageIds() {
    return await this._gmail.users.messages.list({
      auth: this._oauth2Client,
      userId: 'me',
      q: this._query,
    });
  }
  public async getMessage(id: string) {
    return await this._gmail.users.messages.get({
      auth: this._oauth2Client,
      userId: 'me',
      id: id,
    });
  }
  public async sendMessage(params: any) {
    const raw = this._makeBody(params);
    return await this._gmail.users.messages.send({
      auth: this._oauth2Client,
      userId: 'me',
      requestBody: {
        raw: raw,
      },
    });
  }
  private _makeBody = (params) => {
    params.subject = new Buffer(params.subject).toString('base64'); //日本語対応

    const str = [
      `Content-Type: text/html; charset=\"UTF-8\"\n`,
      `MIME-Version: 1.0\n`,
      `Content-Transfer-Encoding: 7bit\n`,
      `to: ${params.to} \n`,
      `from: ${params.from} \n`,
      `subject: =?UTF-8?B?${params.subject}?= \n\n`,
      params.message,
    ].join('');
    return new Buffer(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  public async addLabelToMessage(messageId: string, labelId: string) {
    return await this._gmail.users.messages.modify({
      auth: this._oauth2Client,
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
  }
}

export default GmailApiAdapter;
