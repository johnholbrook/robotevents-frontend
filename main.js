const re = require("robotevents");
var http = require('http');

// authenticate with the RE API
const re_key = process.env.RE_API_KEY || require("./re_key.json").re_key;
re.authentication.setBearer(re_key);

// let test_sku = "RE-VRC-21-5710";
// let test_sku = "RE-VIQC-21-6338";
// let test_sku = "RE-RADC-21-4266";
// let test_sku = "not-an-sku"

// async function main(){
//     let skills = await get_skills(test_sku, 5);
//     console.log(skills);
// }
// main();

/**
 * Get the top n (qualification) rankings for a given event
 * @param {String} sku SKU of the event
 * @param {Number} num_teams Number of teams to return (top n)
 * @returns Array with rank info
 */
async function get_rankings(sku, num_teams){
    let top_n, program, event_info;
    try{
        let event = (await re.events.search({sku: sku}))[0];
        program = event.program.code;
        event_info = {
            sku: sku,
            name: event.name,
            program: program
        }
        let rankings_map = (await event.rankings()).contents;
        top_n = Array.from(rankings_map, ([_k, v]) => v) //convert map to array
               .filter(i => i.rank <= num_teams) //filter to get just the desired number of teams
               .sort((a,b) => a.rank - b.rank); //sort by rank  
    }
    catch(e){
        return {
            error: "Event not found"
        }
    }

    let rank_info;
    if (["VRC", "VEXU"].includes(program)){
        rank_info = top_n.map(e => {
            return {
                Rank: e.rank,
                Team: e.team.name,
                "Avg. WP": round(e.wp / (e.wins + e.losses + e.ties), 2),
                "Avg. AP": round(e.ap / (e.wins + e.losses + e.ties), 2),
                "Avg. SP": round(e.sp / (e.wins + e.losses + e.ties), 2),
                "W-L-T": `${e.wins}-${e.losses}-${e.ties}`
            };
        });
    }
    else if (program == "VIQC"){
        rank_info = top_n.map(e => {
            return {
                Rank: e.rank,
                Team: e.team.name,
                "Avg. Score": e.average_points,
                "Played": e.ties,
            } 
        });
    }
    else if (program == "RADC"){
        rank_info = top_n.map(e => {
            return {
                Rank: e.rank,
                Team: e.team.name,
                "Avg. WP": round(e.wp / (e.wins + e.losses + e.ties), 2),
                "Avg. Score": e.average_points,
                "W-L-T": `${e.wins}-${e.losses}-${e.ties}`
            }
        });
    }
    else{
        return {
            error: "Program not supported"
        }
    }

    return {
        event: event_info,
        rankings: rank_info
    }
}

/**
 * Get the top n (qualification) rankings for a given event as text
 * @param {String} sku SKU of the event
 * @param {Number} num_teams Number of teams to return (top n)
 * @returns object with text description of rank info
 */
async function get_rankings_text(sku, num_teams){
    let rankings = await get_rankings(sku, num_teams);
    if (rankings.error){
        return {
            text: rankings.error
        }
    }
    else{
        let result = `Top ${num_teams} ranked teams for ${rankings.event.name}:`;
        if (["VRC", "VEXU"].includes(rankings.event.program)){
            rankings.rankings.forEach((e, i) => {
                result += `${i==0?"":" |"} ${e.Rank}. ${e.Team} (Avg. ${e["Avg. WP"]} WP / ${e["Avg. AP"]} AP / ${e["Avg. SP"]} SP, ${e["W-L-T"]})`;
            });
        }
        else if (rankings.event.program == "VIQC"){
            rankings.rankings.forEach((e, i) => {
                result += `${i==0?"":" |"} ${e.Rank}. ${e.Team} (Avg. ${e["Avg. Score"]} pts from ${e.Played} matches)`
            });
        }
        else if (rankings.event.program == "RADC"){
            rankings.rankings.forEach((e, i) => {
                result += `${i==0?"":" |"} ${e.Rank} ${e.Team} (Avg. ${e["Avg. WP"]} WP, ${e["W-L-T"]})`
            });
        }
        result += ` | Full results: https://robotevents.com/${rankings.event.sku}.html#results`
        return {
            text: result
        }
    }
}

/**
 * Get the top n skills rankings for a given event
 * @param {String} sku SKU of the event
 * @param {*} num_teams Number of teams to return (top n)
 * @returns Array with skills rank info
 */
async function get_skills(sku, num_teams){
    let top_n_driver, top_n_prog, program, event_info;
    try{
        let event = (await re.events.search({sku: sku}))[0];
        program = event.program.code;
        event_info = {
            sku: sku,
            name: event.name,
            program: program
        }
        let skills_map = (await event.skills()).contents;
        let skills = Array.from(skills_map, ([_k, v]) => v); //convert map to array
        top_n_prog = skills.filter(i => (i.rank <= num_teams && i.type == "programming"))
                    .sort((a,b) => a.rank - b.rank);
        top_n_driver = skills.filter(i => (i.rank <= num_teams && i.type == "driver"))
                        .sort((a,b) => a.rank - b.rank);
    }
    catch(e){
        return {
            error: "Event not found"
        }
    }
    
    let skills_info;
    if (program == "RADC"){
        skills_info = top_n_prog.map(e => {
            return {
                Rank: e.rank,
                Team: e.team.name,
                "Score": e.score,
                "# Attempts": e.attempts
            }
        });
    }
    else if (["VRC", "VEXU", "VIQC"].includes(program)){ // skills info is the same for VIQC/VRC/VEXU
        skills_info = [];
        top_n_prog.forEach((prog, i) => {
            let driver = top_n_driver[i];
            skills_info.push({
                Rank: prog.rank,
                Team: prog.team.name,
                "Score": prog.score + driver.score,
                "Prog.": prog.score,
                "Prog. Attempts": prog.attempts, 
                "Driving": driver.score,
                "Driving Attempts": prog.attempts
            });
        });
    }
    else{
        return {
            error: "Program not supported"
        }
    }

    return {
        event: event_info,
        skills: skills_info
    }
}

/**
 * Get the top n skills rankings for a given event as text
 * @param {String} sku SKU of the event
 * @param {*} num_teams Number of teams to return (top n)
 * @returns object with text desctiption of skills rank info
 */
async function get_skills_text(sku, num_teams){
    let skills = await get_skills(sku, num_teams);

    if (skills.error){
        return {
            text: rankings.error
        }
    }
    else{
        let result = `Top ${num_teams} skills rankings for ${skills.event.name}:`;
        if (["VRC", "VEXU", "VIQC"].includes(skills.event.program)){
            skills.skills.forEach((e, i) => {
                result += `${i==0?"":" |"} ${e.Rank}. ${e.Team} - ${e.Score} pts. (${e.Driving} driving / ${e["Prog."]} prog.)`;
            });
        }
        else if (skills.event.program == "RADC"){
            skills.skills.forEach((e, i) => {
                result += `${i==0?"":" |"} ${e.Rank}. ${e.Team} - ${e.Score} pts. (${e["# Attempts"]} attempts)`;
            });
        }
        result += ` | Full results: https://robotevents.com/${skills.event.sku}.html#results`
        return {
            text: result
        }
    }
}

var server = http.createServer(function (req, res) {
    let split = req.url.split("/");
    let sku = split[1];
    let type = split[2];
    let text = split[3];
    if (sku == undefined || type == undefined) {
        // return a 404
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end("404 Not Found");
    }

    // get the rankings
    else if (["rank", "rankings"].includes(type)) {
        if (text == "text"){
            get_rankings_text(sku, 5).then(e => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(e));
            });
        }
        else{
            get_rankings(sku, 5).then(r => {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(r));
            });
        }
    }
    else if (type == "skills"){
        if (text == "text"){
            get_skills_text(sku, 5).then(e => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(e));
            });
        }
        else{
            get_skills(sku, 5).then(r => {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(r));
            });
        }
    }
    else{
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end("404 Not Found");
    }

    // console.log(sku, type);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT);
console.log(`Server running on port ${PORT}`);

/**
 * Round a number to the specified number of decimal places
 * @param {Number} num The number to round
 * @param {Number} decimals The number of decimal places to round to
 * @returns {Number} The rounded number
 */
 function round(num, decimals) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}