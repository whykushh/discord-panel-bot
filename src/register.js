import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

const commands = [
  new SlashCommandBuilder().setName('panel').setDescription('Open the owner control panel'),
  new SlashCommandBuilder()
    .setName('cmd')
    .setDescription('Run a saved custom command')
    .addSubcommand(sc =>
      sc.setName('run')
        .setDescription('Run a custom command')
        .addStringOption(o => o.setName('name').setDescription('Command name').setRequired(true).setAutocomplete(true))
    )
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log('✅ Registered guild commands');
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('✅ Registered global commands');
    }
  } catch (err) {
    console.error(err);
  }
})();