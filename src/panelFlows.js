import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

export const isOwner = (interaction, ownerId) =>
  interaction.user?.id === ownerId;

export const panelEmbed = () =>
  new EmbedBuilder()
    .setTitle('Owner Control Panel')
    .setDescription('Choose an action below.')
    .setColor(0x5865f2);

export const panelRows = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('create_cmd').setLabel('Create command').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('create_embed').setLabel('Create embed').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('list_cmds').setLabel('List commands').setStyle(ButtonStyle.Secondary),
  ),
];
