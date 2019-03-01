* 3/1/19; 9:53:10 AM by DW
   * update the readme.md file, it's very very old
   * nodeEditorSuite.utilities.buildServerMonitor
      * only write to modena folder
      * include worknotes in the github project
   * Archived serverMonitor folders on..
      * Montana
      * Rockaway3
      * Babylon2
      * Saugerties
   * Remove from startforever.sh scripts
* 2/27/19; 7:32:42 PM by DW
   * What I did
      * restarted stats, which are now located on <a href="http://scripting.com/code/servermonitor/stats.json">scripting.com</a> not <a href="http://fargo.io/testing/servermonitor/stats.json">fargo.io</a>
      * set up a new server, modena.scripting.com that's just running servermonitor and batchloader
         * maybe we'll have another server to watch modena, but this is the servermonitor system, $5 a month on digital ocean.
   * To do
      * get rid of servermonitor folders all over the place
      * get servermonitor out of startforever.sh scripts on servers that have them
* 2/26/19; 7:22:51 PM by DW
   * No more mysteries. Rebuilding from the ground up. Two servers. One watches all the servers. The other watches serverMonitor itself.
