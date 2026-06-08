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
        try {
            fs.writeFileSync(filePath, xml);
        } catch (err) {
            throw new Error(`Failed to write user XML for '${username}': ${err.message}`);
        }
        return filePath;
    },

    deleteUser(username) {
        const filePath = path.join(FS_DIR, `${username}.xml`);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                throw new Error(`Failed to delete user XML for '${username}': ${err.message}`);
            }
            return true;
        }
        return false;
    },

    listUsers() {
        let files;
        try {
            files = fs.readdirSync(FS_DIR);
        } catch (err) {
            console.error(`[xml] Cannot read directory ${FS_DIR}: ${err.message}`);
            return [];
        }
        const users = files
            .filter(f => f.endsWith('.xml'))
            .map(f => {
                try {
                    const xmlContent = fs.readFileSync(path.join(FS_DIR, f), 'utf8');
                    const match = xmlContent.match(/<user id="([^"]+)">/);
                    const username = match ? match[1] : f.replace('.xml','');
                    return { username, extension: username };
                } catch (err) {
                    console.error(`[xml] Failed to read ${f}: ${err.message}`);
                    return null;
                }
            })
            .filter(Boolean);
        return users;
    }
};

