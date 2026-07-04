import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sends the message and appends the assistant reply', async () => {
    const sendPromise = service.send('Hello');

    // User message appears optimistically, before the response arrives.
    expect(service.messages()).toEqual([{ role: 'user', text: 'Hello' }]);
    expect(service.pending()).toBe(true);

    const req = httpMock.expectOne('/api/agent/messages');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: 'Hello' });
    req.flush({ sessionId: 's-1', text: 'Hi there' });
    await sendPromise;

    expect(service.messages()).toEqual([
      { role: 'user', text: 'Hello' },
      { role: 'assistant', text: 'Hi there' },
    ]);
    expect(service.pending()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('includes the stored sessionId on subsequent sends', async () => {
    const first = service.send('First');
    httpMock
      .expectOne('/api/agent/messages')
      .flush({ sessionId: 's-1', text: 'Reply 1' });
    await first;

    const second = service.send('Second');
    const req = httpMock.expectOne('/api/agent/messages');
    expect(req.request.body).toEqual({ message: 'Second', sessionId: 's-1' });
    req.flush({ sessionId: 's-1', text: 'Reply 2' });
    await second;
  });

  it('sets an error and keeps the user message when the request fails', async () => {
    const sendPromise = service.send('Hello');
    httpMock
      .expectOne('/api/agent/messages')
      .flush('boom', { status: 502, statusText: 'Bad Gateway' });
    await sendPromise;

    expect(service.messages()).toEqual([{ role: 'user', text: 'Hello' }]);
    expect(service.error()).toBe('Something went wrong — try again.');
    expect(service.pending()).toBe(false);
  });

  it('clears the previous error on the next send', async () => {
    const failed = service.send('Hello');
    httpMock
      .expectOne('/api/agent/messages')
      .flush('boom', { status: 502, statusText: 'Bad Gateway' });
    await failed;
    expect(service.error()).not.toBeNull();

    const retry = service.send('Hello again');
    expect(service.error()).toBeNull();
    httpMock
      .expectOne('/api/agent/messages')
      .flush({ sessionId: 's-1', text: 'Hi' });
    await retry;
  });

  it('ignores empty input', async () => {
    await service.send('   ');
    httpMock.expectNone('/api/agent/messages');
    expect(service.messages()).toEqual([]);
  });
});
