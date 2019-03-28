const Lib = require('backend-commons-lib');
const {
    QueueCreator,
    App
} = Lib;

const FlowsDao = require('./FlowsDao');
const MessagePublisher = require('./MessagePublisher');
const { RequestHandlers, HttpApi } = require('@openintegrationhub/webhooks');
const { asValue, asClass, asFunction } = require('awilix');
const mongoose = require('mongoose');
const { RabbitMqTransport, EventBus } = require('@openintegrationhub/event-bus');

class WebhooksApp extends App {
    async _run () {
        const container = this.getContainer();
        const config = container.resolve('config');
        const logger = container.resolve('logger');
        const amqp = container.resolve('amqp');
        await amqp.start();
        const channel = await amqp.getConnection().createChannel();
        const queueCreator = new QueueCreator(channel);
        await mongoose.connect(config.get('MONGODB_URI'), {useNewUrlParser: true});

        container.register({
            channel: asValue(channel),
            queueCreator: asValue(queueCreator),
            flowsDao: asClass(FlowsDao),
            messagePublisher: asClass(MessagePublisher),
            httpApi: asClass(HttpApi).singleton(),
            transport: asClass(RabbitMqTransport, {
                injector: () => ({rabbitmqUri: config.get('RABBITMQ_URI')})
            }),
            eventBus: asClass(EventBus, {
                injector: () => ({serviceName: this.constructor.NAME})
            }).singleton(),
        });

        container.loadModules(['./src/event-handlers/**/*.js'], {
            formatName: 'camelCase',
            resolverOptions: {
                register: asFunction
            }
        });

        await container.resolve('eventHandlers').connect();

        const httpApi = container.resolve('httpApi');
        const messagePublisher = container.resolve('messagePublisher');
        httpApi.setLogger(logger);
        httpApi.setHeadHandler((req, res) => new RequestHandlers.Head(req, res).handle());
        httpApi.setGetHandler((req, res) => new RequestHandlers.Get(req, res, messagePublisher).handle());
        httpApi.setPostHandler((req, res) => new RequestHandlers.Post(req, res, messagePublisher).handle());
        httpApi.listen(config.get('LISTEN_PORT'));
    }

    static get NAME() {
        return 'webhooks';
    }
}

module.exports = WebhooksApp;