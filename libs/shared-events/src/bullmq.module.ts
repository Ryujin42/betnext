import {
  type DynamicModule,
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type ConnectionOptions, type JobsOptions, Queue, Worker } from 'bullmq';

/** Politique de retry par défaut (T7.1 DoD : retry exponentiel). */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 60 * 60, count: 1000 },
  removeOnFail: { age: 24 * 60 * 60 },
};

export const BULLMQ_CONNECTION = Symbol('BULLMQ_CONNECTION');
export const BULLMQ_FACTORY = Symbol('BULLMQ_FACTORY');

/** Sous-ensemble de la fabrique injectable — facilite le mocking en test. */
export interface IBullMqFactory {
  /** Renvoie une `Queue` partagée (un seul producteur ioredis par nom de queue dans le process). */
  getQueue(name: string): Queue;
  /** Crée un `Worker` BullMQ avec retry exponentiel par défaut. À appeler une fois (dans un `OnModuleInit`). */
  createWorker<T>(name: string, processor: (data: T) => Promise<void>): Worker;
  /** Options de job par défaut (lecture seule) — partagées par tous les producteurs. */
  defaultJobOptions(): JobsOptions;
}

/**
 * Fabrique partagée de queues / workers BullMQ. Une instance par process,
 * même connexion ioredis pour toutes les queues. Ferme proprement à l'arrêt
 * de l'app.
 */
@Injectable()
export class BullMqFactory implements IBullMqFactory, OnApplicationShutdown {
  private readonly logger = new Logger(BullMqFactory.name);
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];

  constructor(@Inject(BULLMQ_CONNECTION) private readonly connection: ConnectionOptions) {}

  getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
      this.queues.set(name, queue);
    }
    return queue;
  }

  createWorker<T>(name: string, processor: (data: T) => Promise<void>): Worker {
    const worker = new Worker<T>(
      name,
      async (job) => {
        await processor(job.data);
      },
      { connection: this.connection },
    );
    worker.on('failed', (job, err) => {
      this.logger.warn(
        `Job ${name}#${job?.id ?? '?'} en échec (tentative ${job?.attemptsMade ?? '?'}) : ${err.message}`,
      );
    });
    this.workers.push(worker);
    return worker;
  }

  defaultJobOptions(): JobsOptions {
    return DEFAULT_JOB_OPTIONS;
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([
      ...this.workers.map((w) => w.close()),
      ...Array.from(this.queues.values()).map((q) => q.close()),
    ]);
  }
}

/**
 * Module BullMQ partagé (T7.1). `forRoot()` lit `REDIS_URL` et fournit la
 * fabrique sous {@link BULLMQ_FACTORY}. `@Global` : une seule connexion BullMQ
 * par process, partagée entre les producteurs et les workers.
 */
@Global()
@Module({})
export class BullMqModule {
  static forRoot(): DynamicModule {
    return {
      module: BullMqModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: BULLMQ_CONNECTION,
          inject: [ConfigService],
          useFactory: (config: ConfigService): ConnectionOptions => {
            const url = config.get<string>('REDIS_URL');
            if (!url) {
              throw new Error('BullMqModule : REDIS_URL est requis.');
            }
            return { url };
          },
        },
        { provide: BULLMQ_FACTORY, useClass: BullMqFactory },
      ],
      exports: [BULLMQ_FACTORY],
    };
  }
}
