const db = require('better-sqlite3')('perms.db3', {});
let util_functions = require('../util_functions.js');
exports.check_for_alert_channel = db.prepare(
  'SELECT * FROM alert_channels WHERE server=?'
);
exports.check_for_alert_channel_ignore = db.prepare(
  'SELECT * FROM alert_channels_ignore WHERE server=?'
);
let alertchannel = {
  name: 'alertchannel',
  syntax: 'm: alertchannel <enable/ignore/disable>',
  explanation: 'Configure the alert channel',
  matcher: (cmd) => cmd.command == 'alertchannel',
  simplematcher: (cmd) => cmd[0] === 'alertchannel',
  permissions: (msg) => msg.member.hasPermission('MANAGE_CHANNELS'),
  responder: async (msg, cmd, client) => {
    if (cmd.action === 'ignore') {
      db.prepare('REPLACE INTO alert_channels_ignore VALUES (?)').run(
        msg.guild.id
      );
      msg.channel.send(
        'Disabled alert channel warning message. I strongly encourage you to setup an alert channel, it is very important'
      );
    } else if (cmd.action === 'enable') {
      util_functions.assertHasPerms(msg.guild, ['MANAGE_CHANNELS']);
      if (exports.check_for_alert_channel.get(msg.guild.id)) {
        msg.channel.send(
          'An alert channel already exists! You can remove it with `m: alertchannel disable`'
        );
      } else {
        msg.channel.send('What should the channel be named?');
        let channel_name = await msg.channel.awaitMessages(
          (m) => m.author.id == msg.author.id,
          {
            max: 1,
            time: 20000,
          }
        );
        if (!channel_name.array().length) {
          await msg.channel.send(util_functions.desc_embed('Timed out'));
          return;
        }
        msg.channel.send(
          'What role should be allowed to view it? (Probably your moderator role)'
        );
        let role = await msg.channel.awaitMessages(
          (m) => m.author.id == msg.author.id,
          {
            max: 1,
            time: 10000,
          }
        );
        if (!role.array().length) {
          await msg.channel.send(util_functions.desc_embed('Timed out'));
          return;
        }
        let drole = msg.guild.roles.cache.get(
          role.array()[0].content.replace('<@&', '').replace('>', '')
        );
        if (!drole) {
          await msg.channel.send(
            util_functions.desc_embed("Role doesn't exist")
          );
          return;
        }
        let channel = await msg.guild.channels.create(
          channel_name.array()[0].content,
          {
            type: 'text',
            permissionOverwrites: [
              {
                id: msg.guild.id,
                deny: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
              },
              {
                id: client.user.id,
                allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
              },
              {
                id: drole.id,
                allow: ['VIEW_CHANNEL'],
              },
            ],
          }
        );
        db.prepare('INSERT INTO alert_channels VALUES (?, ?)').run(
          msg.guild.id,
          channel.id
        );
        await client.channels.cache
          .get(exports.check_for_alert_channel.get(msg.guild.id).channel)
          .send(util_functions.desc_embed('Alert channel enabled!'));
        await msg.channel.send(
          util_functions.desc_embed(`Created alert channel ${channel}`)
        );
      }
    } else if (cmd.action === 'disable') {
      if (!exports.check_for_alert_channel.get(msg.guild.id)) {
        msg.channel.send("An alert channel doesn't exist in this server!");
      } else {
        try {
          await client.channels.cache
            .get(exports.check_for_alert_channel.get(msg.guild.id).channel)
            .send(util_functions.desc_embed('Alert channel disabled!'));
        } catch (e) {}
        db.prepare('DELETE FROM alert_channels WHERE server=?').run(
          msg.guild.id
        );

        await msg.channel.send(util_functions.desc_embed('Disabled!'));
      }
    }
  },
};
exports.commandModule = {
  title: 'Alert Channel',
  description: 'Commands to configure your alert channel',
  commands: [alertchannel],
};
