import 'dotenv/config';
import express from 'express';
import {
  Client,
  GatewayIntentBits,
  Events,
  InteractionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { load, save } from './store.js';

const { TOKEN, PORT = 3000 } = process.env;

const app = express();
app.get('/', (_, res) => res.status(200).send('OK'));
app.listen(PORT, () => console.log(`Keepalive on :${PORT}`));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.login(TOKEN);
