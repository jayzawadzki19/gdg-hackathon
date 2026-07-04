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

  it('loads chats and selects the newest chat', async () => {
    const promise = service.loadChats();

    httpMock.expectOne('/api/chats').flush([
      {
        id: 1,
        title: 'First chat',
        createdAt: '2026-07-04T10:00:00.000Z',
        updatedAt: '2026-07-04T10:05:00.000Z',
      },
    ]);
    await Promise.resolve(); // let the first await resolve so selectChat issues its request
    httpMock.expectOne('/api/chats/1').flush({
      id: 1,
      title: 'First chat',
      createdAt: '2026-07-04T10:00:00.000Z',
      updatedAt: '2026-07-04T10:05:00.000Z',
      messages: [{ id: 1, role: 'user', text: 'Hello' }],
    });

    await promise;

    expect(service.chats().length).toBe(1);
    expect(service.selectedChatId()).toBe(1);
    expect(service.messages()).toEqual([{ id: 1, role: 'user', text: 'Hello' }]);
  });

  it('leaves the message list empty when no chats exist', async () => {
    const promise = service.loadChats();

    httpMock.expectOne('/api/chats').flush([]);
    await promise;

    expect(service.chats()).toEqual([]);
    expect(service.selectedChatId()).toBeNull();
    expect(service.messages()).toEqual([]);
  });

  it('creates and selects a new chat', async () => {
    const promise = service.createChat();

    httpMock.expectOne('/api/chats').flush({
      id: 2,
      title: 'New chat',
      createdAt: '2026-07-04T11:00:00.000Z',
      updatedAt: '2026-07-04T11:00:00.000Z',
    });

    await promise;

    expect(service.selectedChatId()).toBe(2);
    expect(service.messages()).toEqual([]);
    expect(service.chats()[0].id).toBe(2);
  });

  it('selects a chat and replaces messages with loaded history', async () => {
    const promise = service.selectChat(3);

    httpMock.expectOne('/api/chats/3').flush({
      id: 3,
      title: 'Loaded',
      createdAt: '2026-07-04T12:00:00.000Z',
      updatedAt: '2026-07-04T12:01:00.000Z',
      messages: [{ id: 5, role: 'assistant', text: 'Loaded answer' }],
    });

    await promise;

    expect(service.selectedChatId()).toBe(3);
    expect(service.messages()).toEqual([
      { id: 5, role: 'assistant', text: 'Loaded answer' },
    ]);
  });

  it('creates a chat before sending when none is selected', async () => {
    const promise = service.send('Hello');

    httpMock.expectOne('/api/chats').flush({
      id: 4,
      title: 'New chat',
      createdAt: '2026-07-04T13:00:00.000Z',
      updatedAt: '2026-07-04T13:00:00.000Z',
    });
    await Promise.resolve(); // let createChat resolve so send issues its request
    await Promise.resolve(); // let send resume after createChat and issue messages request
    const sendRequest = httpMock.expectOne('/api/chats/4/messages');
    expect(sendRequest.request.body).toEqual({ message: 'Hello' });
    sendRequest.flush({
      chatId: 4,
      title: 'Hello',
      messages: [
        { id: 6, role: 'user', text: 'Hello' },
        { id: 7, role: 'assistant', text: 'Hi there' },
      ],
    });

    await promise;

    expect(service.selectedChatId()).toBe(4);
    expect(service.chats()[0].title).toBe('Hello');
    expect(service.messages()).toEqual([
      { id: 6, role: 'user', text: 'Hello' },
      { id: 7, role: 'assistant', text: 'Hi there' },
    ]);
  });

  it('sends into the selected chat', async () => {
    const created = service.createChat();
    httpMock.expectOne('/api/chats').flush({
      id: 5,
      title: 'Existing',
      createdAt: '2026-07-04T14:00:00.000Z',
      updatedAt: '2026-07-04T14:00:00.000Z',
    });
    await created;

    const promise = service.send('Continue');
    const request = httpMock.expectOne('/api/chats/5/messages');
    expect(request.request.body).toEqual({ message: 'Continue' });
    request.flush({
      chatId: 5,
      title: 'Existing',
      messages: [
        { id: 8, role: 'user', text: 'Continue' },
        { id: 9, role: 'assistant', text: 'Sure' },
      ],
    });
    await promise;

    expect(service.messages()).toEqual([
      { id: 8, role: 'user', text: 'Continue' },
      { id: 9, role: 'assistant', text: 'Sure' },
    ]);
  });

  it('sets an error and clears pending when send fails', async () => {
    const promise = service.send('Hello');

    httpMock.expectOne('/api/chats').flush({
      id: 6,
      title: 'New chat',
      createdAt: '2026-07-04T15:00:00.000Z',
      updatedAt: '2026-07-04T15:00:00.000Z',
    });
    await Promise.resolve(); // let createChat resolve so send issues its request
    await Promise.resolve(); // let send resume after createChat and issue messages request
    httpMock
      .expectOne('/api/chats/6/messages')
      .flush('boom', { status: 502, statusText: 'Bad Gateway' });

    await promise;

    expect(service.error()).toBe('Something went wrong - try again.');
    expect(service.pending()).toBe(false);
  });
});
