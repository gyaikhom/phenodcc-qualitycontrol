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
Ext.define('PhenoDCC.model.User', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'id',
        type: 'int'
    },
    {
        name: 'firstName',
        type: 'string'
    },
    {
        name: 'lastName',
        type: 'string'
    },
    {
        name: 'email',
        type: 'string'
    },
    {
        name: 'phone',
        type: 'string'
    },
    {
        name: 'address',
        type: 'string'
    },
    {
        name: 'isActive',
        type: 'boolean'
    },
    {
        name: 'created',
        type: 'date',
        dateFormat: 'time'
    },
    {
        name: 'lastUpdate',
        type: 'date',
        dateFormat: 'time'
    },
    {
        name: 'centreId',
        type: 'int'
    }
    ],
    associations: [
    /* Every user belongs to one and only one centre.
     * A centre can have many users.
     */
    {
        type: 'belongsTo',
        model: 'Centre',
        associationKey: 'centreId' /* associated foreign key field in this model */
    },

    /* A user can have many actions.
     * Every action belongs to one and only one user.
     */
    {
        type: 'hasMany',
        model: 'Action',
        primaryKey: 'id', /* primary key in the Action model */
        foreignKey: 'actionedBy' /* associated foreign key in the Action model */
    },

    /* A user can have many issues that they must handle.
     * Every issue belongs to one and only one user who handles it.
     */
    {
        type: 'hasMany',
        model: 'Issue',
        primaryKey: 'id', /* primary key in the Issue model */
        foreignKey: 'assignedTo' /* associated foreign key in the Issue model */
    }
    ],
    requires: [
    'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/users/extjs',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'users',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
