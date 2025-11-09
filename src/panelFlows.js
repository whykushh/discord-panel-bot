import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  EmbedBuilder
} from 'discord.js';

// ====== Owner check ======
export const isOwner = (interaction, ownerId) => interaction.user.id === ownerId;

// ====== Panel Embed ======
export const panelEmbed = () => new EmbedBuilder()
  .setTitle('Owner Control Panel')
  .setDescription('Create embeds, add buttons/selects, and manage custom commands.')
  .setColor(0x5865F2)
  .setFooter({ text: 'Owner only access' });

// ====== Panel Buttons ======
export const panelRows = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('make_embed').setLabel('Create / Preview Embed').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('create_command').setLabel('Create Custom Command').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('list_commands').setLabel('List Commands').setStyle(ButtonStyle.Secondary)
  )
];

// ====== Embed Creation Modal ======
export const makeEmbedModal = () => new ModalBuilder()
  .setCustomId('modal_make_embed')
  .setTitle('Create Embed')
  .addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Embed Title (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Embed Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Hex Color (optional, e.g. #5865F2)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('thumbnail')
        .setLabel('Thumbnail URL (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('image')
        .setLabel('Image URL (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    )
  );

// ====== Buttons Modal ======
export const buttonConfigModal = () => new ModalBuilder()
  .setCustomId('modal_buttons')
  .setTitle('Add Buttons')
  .addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('buttons_json')
        .setLabel('Buttons JSON (array)')
        .setPlaceholder('[{"label":"Example","style":"Link","url":"https://example.com"}]')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

// ====== Select Menu Modal ======
export const selectConfigModal = () => new ModalBuilder()
  .setCustomId('modal_select')
  .setTitle('Add Select Menu')
  .addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('select_json')
        .setLabel('Select Menu JSON')
        .setPlaceholder('{"customId":"roles","placeholder":"Choose a role","options":[{"label":"A","value":"a"}]}')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

// ====== Custom Command Modal ======
export const makeCommandModal = () => new ModalBuilder()
  .setCustomId('modal_make_command')
  .setTitle('Create Custom Command')
  .addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('cmd_name')
        .setLabel('Command Name (no spaces)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('cmd_type')
        .setLabel('Type (text or embed)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('cmd_payload')
        .setLabel('Payload (message text or embed key)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

// ====== Builders ======
export const buildButtonsFromJson = (jsonArr) => {
  const rows = [];
  let row = new ActionRowBuilder();

  for (const btn of jsonArr) {
    const styleMap = {
      Primary: ButtonStyle.Primary,
      Secondary: ButtonStyle.Secondary,
      Success: ButtonStyle.Success,
      Danger: ButtonStyle.Danger,
      Link: ButtonStyle.Link
    };

    const b = new ButtonBuilder().setLabel(btn.label || 'Button');
    if (btn.style === 'Link') {
      b.setStyle(styleMap.Link).setURL(btn.url || 'https://discord.com');
    } else {
      b.setStyle(styleMap[btn.style] || ButtonStyle.Secondary).setCustomId(btn.customId || `btn_${Math.random().toString(36).slice(2, 8)}`);
    }

    row.addComponents(b);
    if (row.components.length === 5) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
  }

  if (row.components.length) rows.push(row);
  return rows;
};

export const buildSelectFromJson = (obj) => {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(obj.customId || `select_${Math.random().toString(36).slice(2, 8)}`)
    .setPlaceholder(obj.placeholder || 'Select an option')
    .addOptions(...(obj.options || []));
  return [new ActionRowBuilder().addComponents(menu)];
};

export const makeEmbedFromInputs = ({ title, description, color, thumbnail, image }) => {
  const embed = new EmbedBuilder();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (color && /^#?[0-9A-Fa-f]{6}$/.test(color)) embed.setColor(parseInt(color.replace('#', ''), 16));
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  embed.setTimestamp(new Date());
  return embed;
};
