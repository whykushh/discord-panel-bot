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
import {
  isOwner,
  panelEmbed,
  panelRows,
  makeEmbedModal,
  buttonConfigModal,
  selectConfigModal,
  makeCommandModal,
  buildButtonsFromJson,
  buildSelectFromJson,
  makeEmbedFromInputs
} from './panelFlows.js';

const { TOKEN, OWNER_ID, PORT = 3000 } = process.env;

// ====== Keepalive for Render ======
const app = express();
app.get('/', (_, res) => res.status(200).send('OK'));
app.listen(PORT, () => console.log(`Keepalive on :${PORT}`));

// ====== Discord client ======
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
});

// ====== Slash Command Handling ======
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ---- Handle /panel ----
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
      console.log('Panel command triggered by', interaction.user.tag);

      // Owner-only protection
      if (!isOwner(interaction, OWNER_ID))
        return interaction.reply({ content: 'Owner only.', ephemeral: true });

      // Reply with your panel
      await interaction.reply({
        embeds: [panelEmbed()],
        components: panelRows(),
        ephemeral: true
      });

      return;
    }

    // ---- Handle /cmd run ----
    if (interaction.isChatInputCommand() && interaction.commandName === 'cmd') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'run') {
        const store = load('commands.json');
        const name = interaction.options.getString('name');
        const found = store.commands.find(c => c.name === name);
        if (!found) return interaction.reply({ content: 'Command not found.', ephemeral: true });
        if (found.type === 'text')
          return interaction.reply({ content: found.payload });
        if (found.type === 'embed') {
          const eStore = load('embeds.json');
          const eb = eStore.embeds.find(e => e.key === found.payload);
          if (!eb) return interaction.reply({ content: 'Embed not found.', ephemeral: true });
          return interaction.reply({
            embeds: [new EmbedBuilder(eb.embed)],
            components: eb.components?.length ? eb.components.map(r => ({ ...r })) : []
          });
        }
      }
    }

  } catch (err) {
    console.error('❌ Interaction error:', err);
    if (interaction.isRepliable())
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
  }
});

client.login(TOKEN);
