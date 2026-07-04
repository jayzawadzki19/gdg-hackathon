import axios from 'axios';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { AgentService } from './agent.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AgentService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      ADK_AGENT_URL: 'http://adk-agent:8081',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates a session when no sessionId is provided', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'new-session' } })
      .mockResolvedValueOnce({
        data: [
          'data: {"author":"root_agent","content":{"parts":[{"text":"Solved."}]}}',
          '',
        ].join('\n'),
      });

    const service = new AgentService();

    await expect(
      service.sendMessage({ message: 'Solve this contradiction' }),
    ).resolves.toEqual({
      sessionId: 'new-session',
      text: 'Solved.',
    });

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      'http://adk-agent:8081/apps/agent/users/user/sessions',
      {},
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      'http://adk-agent:8081/run_sse',
      {
        appName: 'agent',
        userId: 'user',
        sessionId: 'new-session',
        newMessage: {
          role: 'user',
          parts: [{ text: 'Solve this contradiction' }],
        },
      },
      {
        headers: {
          Accept: 'text/event-stream',
        },
        responseType: 'text',
      },
    );
  });

  it('reuses a provided sessionId', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: [
        'data: {"author":"root_agent","content":{"parts":[{"text":"Still solved."}]}}',
        '',
      ].join('\n'),
    });

    const service = new AgentService();

    await expect(
      service.sendMessage({
        message: 'Continue',
        sessionId: 'existing-session',
      }),
    ).resolves.toEqual({
      sessionId: 'existing-session',
      text: 'Still solved.',
    });

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://adk-agent:8081/run_sse',
      expect.objectContaining({ sessionId: 'existing-session' }),
      expect.any(Object),
    );
  });

  it('rejects empty messages', async () => {
    const service = new AgentService();

    await expect(service.sendMessage({ message: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('extracts the latest non-user model text from event stream data', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { sessionId: 'session-from-alt-key' } })
      .mockResolvedValueOnce({
        data: [
          'data: {"author":"user","content":{"parts":[{"text":"Question"}]}}',
          'data: {"author":"root_agent","content":{"parts":[{"text":"First draft"}]}}',
          'data: {"author":"root_agent","content":{"parts":[{"text":"Final answer"}]}}',
          '',
        ].join('\n'),
      });

    const service = new AgentService();

    await expect(service.sendMessage({ message: 'Question' })).resolves.toEqual({
      sessionId: 'session-from-alt-key',
      text: 'Final answer',
    });
  });

  it('maps upstream session failures to BadGatewayException', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('connection refused'));

    const service = new AgentService();

    await expect(service.sendMessage({ message: 'Question' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps malformed run responses to BadGatewayException', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'new-session' } })
      .mockResolvedValueOnce({ data: 'data: {"author":"root_agent"}\n\n' });

    const service = new AgentService();

    await expect(service.sendMessage({ message: 'Question' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
