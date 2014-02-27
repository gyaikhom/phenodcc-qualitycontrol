<!--
Copyright 2012 Medical Research Council Harwell.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

@author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>

-->
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
    <head>
        <title>PhenoDCC Quality Control Web Application</title>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
        <link href='https://fonts.googleapis.com/css?family=Roboto:400,300' rel='stylesheet' type='text/css'>
        <link rel="stylesheet" type="text/css" href="resources/css/phenodcc.DCC_QC_VERSION.css">
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
            if (records.uid === 0)
                window.location = "../user/login?destination=/qc";
            else {
                /* this is the global variable where
                 * we expose the public interfaces */
                if (typeof dcc === 'undefined')
                    dcc = {};
                dcc.roles = records;
            }
        </script>

        <div id="app-loading">
            <div id="app-loading-logo"</div>
            <div id="app-loading-gear"></div>
        </div>

        <script type="text/javascript" src="app.DCC_QC_VERSION.js"></script>
        <script>
            Ext.onReady(function() {
                dcc.dataContext = {
                    cid: parseInt('<%= request.getParameter("cid")%>'),
                    gid: parseInt('<%= request.getParameter("gid")%>'),
                    sid: parseInt('<%= request.getParameter("sid")%>'),
                    lid: parseInt('<%= request.getParameter("lid")%>'),
                    pid: parseInt('<%= request.getParameter("pid")%>'),
                    peid: '<%= request.getParameter("peid")%>',
                    qid: parseInt('<%= request.getParameter("qid")%>'),
                    qeid: '<%= request.getParameter("qeid")%>',
                    aid: parseInt('<%= request.getParameter("aid")%>')
                };
                if (isNaN(dcc.dataContext.cid)) dcc.dataContext.cid = -1;
                if (isNaN(dcc.dataContext.gid)) dcc.dataContext.gid = -1;
                if (isNaN(dcc.dataContext.sid)) dcc.dataContext.sid = -1;
                if (isNaN(dcc.dataContext.lid)) dcc.dataContext.lid = -1;
                if (isNaN(dcc.dataContext.pid)) dcc.dataContext.pid = -1;
                if (isNaN(dcc.dataContext.qid)) dcc.dataContext.qid = -1;
                if (isNaN(dcc.dataContext.aid)) dcc.dataContext.aid = -1;
                
                dcc.allissuesFilter = parseInt('<%= request.getParameter("if")%>');
                if (isNaN(dcc.allissuesFilter))  dcc.allissuesFilter = 63;

                dcc.control_options = {
                    'series': parseInt('<%= request.getParameter("sctrl")%>'),
                    'point': parseInt('<%= request.getParameter("pctrl")%>')
                }
                if (isNaN(dcc.control_options.series)
                    && isNaN(dcc.control_options.point))
                    dcc.control_options = null;
            })
        </script>
    </body>
</html>
