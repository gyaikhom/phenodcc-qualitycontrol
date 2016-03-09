<%@page contentType="text/html" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
    <head>
        <title>PhenoDCC Quality Control Web Application</title>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta http-equiv="X-UA-Compatible" content="chrome=1" />
        <link rel="stylesheet" type="text/css" href="/imageviewer/css/imageviewer.css">
        <link rel="stylesheet" type="text/css" href="resources/css/phenodcc.css">
        <link rel="stylesheet" type="text/css" href="resources/css/viz.css">
        <link href='https://fonts.googleapis.com/css?family=Source+Sans+Pro:200,300,400,600' rel='stylesheet' type='text/css'>
    </head>
    <body>
        <!--[if lt IE 9]>
        <script>
            window.location = "unsupported.jsp";
        </script>
        <![endif]-->

        <script>
            var req = new XMLHttpRequest(), now = new Date();
            req.open('GET', '../roles?_dc=' + now.getTime(), false);
            req.setRequestHeader("Accept", "application/json");
            req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
            req.send(null);
            var records = JSON.parse(req.responseText);
            function isQualityControlUser(roles) {
                var i, c = roles.length;
                for (i = 0; i < c; ++i)
                    if ('qc user' === roles[i])
                        return true;
                return false;
            }
            if (records.uid === 0)
                window.location = "../user/login?destination=/qc";
            else {
                if (isQualityControlUser(records.roles)) {
                    /* this is the global variable where
                     * we expose the public interfaces */
                    if (typeof dcc === 'undefined')
                        dcc = {};
                    dcc.roles = records;
                } else {
                    window.location = "noaccess.html";
                }
            }
        </script>

        <div id="app-loading">
            <div id="app-loading-logo"</div>
            <div id="app-loading-gear"></div>
        </div>

        <script type="text/javascript" src="viz/d3.v3.min.js"></script>
        <script type="text/javascript" src="/imageviewer/js/imageviewer.js"></script>
        <script type="text/javascript" src="viz/visualise.js"></script>
        <script type="text/javascript" src="extjs/ext-debug.js"></script>
        <script type="text/javascript" src="app.js"></script>

        <script>
            Ext.onReady(function () {
                /**
                 * The data context sets the context on which to carry out the quality
                 * control of the measurements. It is defined by the centre which conducted
                 * the experiments, which genotype and background strain the experiments
                 * were conducted on, and which procedures were applied. Note that we store
                 * two representations of the procedure identifier: one is the unique Id
                 * assigned by the database as primary key, and the other is the EMPReSS
                 * identifier. We shorten the name so that:
                 *
                 *     1) the web services queries are shorter, and most importantly,
                 *     2) to minimise the size of the JSON responses returned by these web
                 *         services. Note that the JSON responses include attribute names.
                 *
                 * Within a data context, we may wish to inspect the data further. For
                 * instance, you may wish to get the measurements for a given animal for
                 * a given parameter. To do we define the measurement context within the
                 * data context defined above. In this context, we specify the EMPReSS
                 * parameter identifier, and the specimen identifier which
                 * links all of the measurements to procedure, parameters and specimens.
                 */
                dcc.dataContext = {
                    cid: parseInt('<%= request.getParameter("cid")%>'), /* centre Id */
                    gid: parseInt('<%= request.getParameter("gid")%>'), /* genotype Id */
                    sid: parseInt('<%= request.getParameter("sid")%>'), /* background strain Id */
                    lid: parseInt('<%= request.getParameter("lid")%>'), /* pipeline Id */
                    pid: parseInt('<%= request.getParameter("pid")%>'), /* procedure Id */
                    peid: '<%= request.getParameter("peid")%>', /* EMPReSS procedure Id */
                    qid: parseInt('<%= request.getParameter("qid")%>'), /* parameter Id */
                    qeid: '<%= request.getParameter("qeid")%>', /* EMPReSS parameter Id */
                    aid: parseInt('<%= request.getParameter("aid")%>') /* animal Id */
                };
                if (isNaN(dcc.dataContext.cid))
                    dcc.dataContext.cid = -1;
                if (isNaN(dcc.dataContext.gid))
                    dcc.dataContext.gid = -1;
                if (isNaN(dcc.dataContext.sid))
                    dcc.dataContext.sid = -1;
                if (isNaN(dcc.dataContext.lid))
                    dcc.dataContext.lid = -1;
                if (isNaN(dcc.dataContext.pid))
                    dcc.dataContext.pid = -1;
                if (isNaN(dcc.dataContext.qid))
                    dcc.dataContext.qid = -1;
                if (isNaN(dcc.dataContext.aid))
                    dcc.dataContext.aid = -1;

                dcc.allissuesFilter = parseInt('<%= request.getParameter("if")%>');
                if (isNaN(dcc.allissuesFilter))
                    dcc.allissuesFilter = 63;

                var ctrl = parseInt('<%= request.getParameter("ctrl")%>');
                if (!isNaN(ctrl))
                    dcc.visualisationControl = ctrl;
            });
        </script>
    </body>
</html>
