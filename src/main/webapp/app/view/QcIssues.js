/*
 * Copyright 2012 Medical Research Council Harwell.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
Ext.define('PhenoDCC.view.QcIssues', {
    extend: 'Ext.container.Container',
    title: 'Quality Control issues',
    alias: 'widget.qcissues',
    requires: [
    'PhenoDCC.view.IssuesPanel'
    ],
    layout: 'fit',
    items: {
        xtype: 'container',
        layout: 'border',
        border: 0,
        items: [
        {
            xtype: 'issuespanel',
            id: 'data-view-issues-panel',
            region: 'east',
            width: '50%',
            split: true,
            layout: 'border',
            border: 0
        },
        {
            xtype: 'container',
            id: 'data-view-actions-panel',
            region: 'center',
            width: '50%',
            layout: 'border',
            border: 0
        }
        ]
    }
});
