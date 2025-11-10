import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const rest = new REST({ version: '10' }).setToken(TOKEN);

const commands = [
  new SlashCommandBuilder().setName('panel').setDescription('Open the owner control panel'),
  new SlashCommandBuilder().setName('announce').setDescription('Create an announcement (embed or text)'),
  new SlashCommandBuilder()
    .setName('trial')
    .setDescription('Accept or decline a trial moderator')
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(o =>
      o.setName('action')
       .setDescription('Action')
       .setRequired(true)
       .addChoices({ name: 'accept', value: 'accept' }, { name: 'decline', value: 'decline' })
    ),
];

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
