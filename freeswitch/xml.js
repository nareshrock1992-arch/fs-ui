const fs = require('fs');
const path = require('path');

const FS_DIR = "/usr/local/freeswitch/conf/directory/default";

// Only alphanumeric, underscore, hyphen, dot — no path separators
const SAFE_NAME = /^[a-zA-Z0-9_.\-]{1,64}$/;

function safePath(username) {
    if (!SAFE_NAME.test(username)) {
        throw new Error('Invalid username: must be 1-64 alphanumeric/underscore/hyphen/dot characters');
    }
    const filePath = path.join(FS_DIR, `${username}.xml`);
    // Belt-and-suspenders: ensure the resolved path stays within FS_DIR
    if (!path.resolve(filePath).startsWith(path.resolve(FS_DIR) + path.sep)) {
        throw new Error('Path traversal detected');
    }
    return filePath;
}

module.exports = {
    addUser(username, password) {
        const filePath = safePath(username);
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
        const filePath = safePath(username);
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

