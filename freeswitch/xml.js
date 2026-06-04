const fs = require('fs');
const path = require('path');

const FS_DIR = "/usr/local/freeswitch/conf/directory/default";

module.exports = {
    addUser(username, password) {
        const filePath = path.join(FS_DIR, `${username}.xml`);
        const xml = `
<include>
  <user id="${username}">
    <params>
      <param name="password" value="${password}"/>
    </params>
  </user>
</include>
`;
        fs.writeFileSync(filePath, xml);
        return filePath;
    },

    deleteUser(username) {
        const filePath = path.join(FS_DIR, `${username}.xml`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    },

    listUsers() {
        const files = fs.readdirSync(FS_DIR);
        const users = files
            .filter(f => f.endsWith('.xml'))
            .map(f => {
                const xmlContent = fs.readFileSync(path.join(FS_DIR, f), 'utf8');
                const match = xmlContent.match(/<user id="([^"]+)">/);
                const username = match ? match[1] : f.replace('.xml','');
                return { username, extension: username };
            });
        return users;
    }
};

