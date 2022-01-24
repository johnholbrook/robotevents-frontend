const re = require("robotevents");
var http = require('http');

// authenticate with the RE API
const re_key = process.env.RE_API_KEY || require("./config.json").re_key;
re.authentication.setBearer(re_key);

// async function main(){
//     let tmp = await get_vrc_team_stats("27183R");
//     console.log(tmp);
// }
// main();

/**
 * Determine whether a team won, lost, or tied a particular match
 * @param {Object} match - match info returned from RE API
 * @param {String} team - team number (e.g. "8768A")
 */
function get_match_result(match, team){
    let red = match.alliances.find(a => a.color=="red");
    let blue = match.alliances.find(a => a.color=="blue");
    
    let team_alliance = red.teams.find(t => t.team.name==team) ? "red" : "blue";

    if (red.score > blue.score){// red won
        return team_alliance == "red" ? "win" : "loss";
    }
    else if (blue.score > red.score){ // blue won
        return team_alliance == "blue" ? "win" : "loss";
    }
    else{// tie
        return "tie"
    }
}

/**
 * Get stats for a VRC team
 * @param {String} team_num - Team number (e.g. "8768A")
 */
async function get_vrc_team_stats(team_num){
    // get team
    let team = (await re.teams.search({
        number: team_num,
        program: re.programs.get("VRC")
    }))[0];
    if (team == undefined) return {error: "Team not found"};

    // get rankings
    let rankings_map = (await team.rankings({season: re.seasons.current("VRC")})).contents;
    let rankings = Array.from(rankings_map, ([_k, v]) => v); //convert map to array

    // calculate some stats based on the rankings
    let awp_count = 0;
    let qual_matches = 0;
    let total_ap = 0;
    let wins = 0;
    let losses = 0;
    let ties = 0;

    rankings.forEach(r => {
        qual_matches += r.wins + r.losses + r.ties;
        awp_count += r.wp - ( (2*r.wins) + r.ties);
        total_ap += r.ap;

        wins += r.wins;
        losses += r.losses;
        ties += r.ties;
    });

    // also get elimination matches, and add those to the W-L-T stats
    // disabled for now because the matches API is way too slow
    // let matches_map = (await team.matches({
    //     round: [3,4,5,6],
    //     season: re.seasons.current("VRC")
    // })).contents;
    // let elim_matches = Array.from(matches_map, ([_k, v]) => v); //convert map to array
    
    // elim_matches.forEach(m => {
    //     let result = get_match_result(m, team_num);
    //     if (result == "win") wins += 1;
    //     else if (result == "loss") losses += 1;
    //     else ties += 1;
    // });
    
    // return matches;

    return {
        "awp_rate": `${round((awp_count/qual_matches)*100, 0)}%`,
        "avg_ap": round(total_ap/qual_matches, 1),
        "record": `${wins}-${losses}-${ties}`
    }

}

/**
 * Get stats for a VEXU team
 * @param {String} team_num - Team number (e.g. "SQL")
 */
async function get_vexu_team_stats(team_num){
    return {
        error: "Team stats for VEXU are not yet supported."
    }
}

/**
 * Get stats for a VIQC team
 * @param {String} team_num - Team number (e.g. "1234A")
 */
async function get_viqc_team_stats(team_num){
    let team = (await re.teams.search({
        number: team_num,
        program: re.programs.get("VIQC")
    }))[0];

    if (team == undefined) return {error: "Team not found"};

    // get rankings (to calculate some stats)
    let rankings_map = (await team.rankings({season: re.seasons.current("VIQC")})).contents;
    let rankings = Array.from(rankings_map, ([_k, v]) => v); //convert map to array

    let high_score = 0;
    let avg_scores = [];

    // for each event...
    rankings.forEach(r => {
        // update high score
        if (r.high_score > high_score) high_score = r.high_score;

        // update avg score array (for IQ, "ties" == total matches)
        [...Array(r.ties).keys()].forEach(_i => {
            avg_scores.push(r.average_points);
        });
    });

    // calculate overall average score
    let avg_score = avg_scores.length > 0 ? round(avg_scores.reduce((a,c) => a+c) / avg_scores.length, 0) : "N/A";

    if (avg_scores.length == 0) high_score = "N/A"

    // get skills
    let skills_map = (await team.skills({
        season: re.seasons.current("VIQC"),
        type: "driver"
    })).contents;
    let skills = Array.from(skills_map, ([_k, v]) => v); //convert map to array

    // return skills;

    let highest_driver = Math.max(skills.filter(s => s.type=="driver").map(s => s.score));
    // // let highest_prog = Math.max(skills.filter(s => s.type=="programming").map(s => s.score));

    return {
        high_score: high_score,
        avg_score: avg_score,
        max_d_skills: highest_driver ? highest_driver : "N/A"
    }
}

/**
 * Get stats for a RADC team
 * @param {String} team_num - Team number (e.g. "1234A")
 */
async function get_radc_team_stats(team_num){
    let team = (await re.teams.search({
        number: team_num,
        program: re.programs.get("RADC")
    }))[0];

    if (team == undefined) return {error: "Team not found"};

    let rankings_map = (await team.rankings({season: re.seasons.current("RADC")})).contents;

    let rankings = Array.from(rankings_map, ([_k, v]) => v); //convert map to array

    let high_score = 0;
    let avg_scores = [];
    let wins = 0;
    let losses = 0;
    let ties = 0;

    // for each event...
    rankings.forEach(r => {
        // update high score
        if (r.high_score > high_score) high_score = r.high_score;

        // update W-L-T
        wins += r.wins;
        losses += r.losses;
        ties += r.ties;

        // update avg score array
        let this_event_matches = r.wins + r.losses + r.ties;
        [...Array(this_event_matches).keys()].forEach(_i => {
            avg_scores.push(r.average_points);
        });
    });

    // calculate overall average score
    let avg_score = avg_scores.length > 0 ? round(avg_scores.reduce((a,c) => a+c) / avg_scores.length, 0) : "N/A";

    if (avg_scores.length == 0) high_score = "N/A"

    // // get skills
    // let skills_map = (await team.skills({
    //     season: re.seasons.current("RADC"),
    //     type: "programming"
    // })).contents;
    // let skills = Array.from(skills_map, ([_k, v]) => v); //convert map to array
    // let max_skills = Math.max(skills.map(s => s.score));

    return {
        high_score: high_score,
        avg_score: avg_score,
        record: `${wins}-${losses}-${ties}`
        // max_skills: max_skills
    };

}

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
        let result = `Top ${num_teams} ranked teams for ${rankings.event.name}: `;
        if (["VRC", "VEXU"].includes(rankings.event.program)){
            rankings.rankings.forEach((e, i) => {
                // result += `${i==0?"":" |"} ${e.Rank}. ${e.Team} (Avg. ${e["Avg. WP"]} WP / ${e["Avg. AP"]} AP / ${e["Avg. SP"]} SP, ${e["W-L-T"]})`;
                result += `${e.Rank}. ${e.Team} `;
            });
        }
        else if (rankings.event.program == "VIQC"){
            rankings.rankings.forEach((e, i) => {
                // result += `${i==0?"":" |"} ${e.Rank}. ${e.Team} (Avg. ${e["Avg. Score"]} pts from ${e.Played} matches)`
                result += `${e.Rank}. ${e.Team} `;
            });
        }
        else if (rankings.event.program == "RADC"){
            rankings.rankings.forEach((e, i) => {
                // result += `${i==0?"":" |"} ${e.Rank} ${e.Team} (Avg. ${e["Avg. WP"]} WP, ${e["W-L-T"]})`
                result += `${e.Rank}. ${e.Team} `;
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
                // result += `${i==0?"":" |"} ${e.Rank}. ${e.Team} - ${e.Score} pts. (${e.Driving} driving / ${e["Prog."]} prog.)`;
                result += `${i==0?"":" |"} ${e.Rank}. ${e.Team} (${e.Score} pts.)`;
            });
        }
        else if (skills.event.program == "RADC"){
            skills.skills.forEach((e, i) => {
                // result += `${i==0?"":" |"} ${e.Rank}. ${e.Team} - ${e.Score} pts. (${e["# Attempts"]} attempts)`;
                result += `${i==0?"":" |"} ${e.Rank}. ${e.Team} (${e.Score} pts.) `;
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

    let endpoint = split[1];

    if (endpoint == "team"){
        let program = split[2].toUpperCase();
        let team = split[3];
        if (program == "VIQC"){
            get_viqc_team_stats(team).then(r => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(r));
            });
        }
        else if (program == "VRC"){
            get_vrc_team_stats(team).then(r => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(r));
            });
        }
        else if (program == "RADC"){
            get_radc_team_stats(team).then(r => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(r));
            });
        }
        else if (program == "VEXU"){
            get_vexu_team_stats(team).then(r => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end(JSON.stringify(r));
            });
        }
        else{
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify({
                error: "Program not supported."
            }));
        }
    }
    else if (["rank", "rankings"].includes(endpoint)){
        let sku = split[2];
        if (split[3] == "text"){
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
    else if (endpoint == "skills"){
        let sku = split[2];
        if (split[3] == "text"){
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
        // return a 404
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end("404 Not Found");
    }
});

const PORT = process.env.PORT || require("./config.json").port;
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
