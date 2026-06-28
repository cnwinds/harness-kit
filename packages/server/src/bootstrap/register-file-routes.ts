import fs from 'node:fs/promises';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ChatUser } from '@harnesskit/protocol';
import type { HarnessConfig } from '@harnesskit/core';
import { hydrateFileRecordById } from './hydrate-file-records.js';
import type { LocalFileService } from './local-file-service.js';

const encodeContentDisposition = (fileName: string, disposition: 'inline' | 'attachment') => {
  const encoded = encodeURIComponent(fileName);
  return `${disposition}; filename="${encoded}"; filename*=UTF-8''${encoded}`;
};

const resolveDownload = async (args: {
  config: HarnessConfig;
  fileService: LocalFileService;
  userId: string;
  fileId: string;
}) => {
  try {
    return await args.fileService.resolveDownloadPath(args.userId, args.fileId);
  } catch {
    const hydrated = await hydrateFileRecordById({
      dataRoot: args.config.DATA_ROOT,
      userId: args.userId,
      fileId: args.fileId,
      fileService: args.fileService,
    });
    if (!hydrated) {
      throw new Error(`文件不存在：${args.fileId}`);
    }
    return args.fileService.resolveDownloadPath(args.userId, args.fileId);
  }
};

const sendFile = async (args: {
  reply: FastifyReply;
  absolutePath: string;
  file: { displayName: string; mimeType: string | null };
  disposition: 'inline' | 'attachment';
}) => {
  const buffer = await fs.readFile(args.absolutePath);
  return args.reply
    .header('Content-Type', args.file.mimeType ?? 'application/octet-stream')
    .header('Content-Disposition', encodeContentDisposition(args.file.displayName, args.disposition))
    .send(buffer);
};

export const registerFileRoutes = (args: {
  app: FastifyInstance;
  prefix: string;
  config: HarnessConfig;
  fileService: LocalFileService;
  resolveUser: (request: FastifyRequest) => Promise<ChatUser | null>;
}) => {
  const handleFileRequest = async (
    request: FastifyRequest,
    reply: FastifyReply,
    disposition: 'inline' | 'attachment',
  ) => {
    const user = await args.resolveUser(request);
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { fileId } = request.params as { fileId: string };
    try {
      const { absolutePath, file } = await resolveDownload({
        config: args.config,
        fileService: args.fileService,
        userId: user.id,
        fileId,
      });
      return sendFile({
        reply,
        absolutePath,
        file,
        disposition,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '文件读取失败';
      return reply.code(404).send({ error: message });
    }
  };

  args.app.get(`${args.prefix}/files/:fileId/preview`, async (request, reply) => (
    handleFileRequest(request, reply, 'inline')
  ));

  args.app.get(`${args.prefix}/files/:fileId/download`, async (request, reply) => (
    handleFileRequest(request, reply, 'attachment')
  ));
};
