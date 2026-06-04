const db=require("./db")

let previousMembers={}

function updateConferenceState(participants){

const current={}

participants.forEach(p=>{

const key=`${p.conferenceName}_${p.memberId}`

current[key]=p

if(!previousMembers[key]){

db.run(

`INSERT INTO conference_history
(conference_name,member_id,extension)

VALUES(?,?,?)`,

[p.conferenceName,p.memberId,p.user]

)

console.log("JOIN",key)

}

})

Object.keys(previousMembers).forEach(key=>{

if(!current[key]){

const old=previousMembers[key]

db.run(

`

UPDATE conference_history

SET

leave_time=datetime('now'),

duration=

strftime('%s','now')

-

strftime('%s',join_time),

active=0

WHERE

conference_name=?

AND member_id=?

AND active=1

`,

[old.conferenceName,old.memberId]

)

console.log("LEAVE",key)

}

})

previousMembers=current

}

module.exports={updateConferenceState}
