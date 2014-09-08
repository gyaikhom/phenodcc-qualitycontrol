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
package org.mousephenotype.dcc.qualitycontrol.entities;

import java.io.Serializable;
import javax.persistence.Entity;
import javax.persistence.Id;
import org.mousephenotype.dcc.entities.qc.DataContext;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Entity
public class AnIssueResponse implements Serializable {

    private static final long serialVersionUID = 1L;
    @Id
    private Long id;
    private String priority;
    private String status;
    private String raisedBy;
    private Integer raisedByUid;
    private String assignedTo;
    private Long lastUpdate;
    private String title;
    private String description;
    private DataContext context;
    private String peid;
    private String qeid;
    private String procedure;
    private String parameter;

    public AnIssueResponse() {
    }

    public AnIssueResponse(Long id, String title, String description,
            String priority, String status, String raisedBy,
            Integer raisedByUid, String assignedTo, Long lastUpdate,
            DataContext context, String peid, String procedure,
            String qeid, String parameter) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.priority = priority;
        this.status = status;
        this.raisedBy = raisedBy;
        this.raisedByUid = raisedByUid;
        this.assignedTo = assignedTo;
        this.lastUpdate = lastUpdate;
        this.context = context;
        this.peid = peid;
        this.procedure = procedure;
        this.qeid = qeid;
        this.parameter = parameter;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRaisedBy() {
        return raisedBy;
    }

    public void setRaisedBy(String raisedBy) {
        this.raisedBy = raisedBy;
    }

    public Integer getRaisedByUid() {
        return raisedByUid;
    }

    public void setRaisedByUid(Integer raisedByUid) {
        this.raisedByUid = raisedByUid;
    }

    public String getAssignedTo() {
        return assignedTo;
    }

    public void setAssignedTo(String assignedTo) {
        this.assignedTo = assignedTo;
    }

    public Long getLastUpdate() {
        return lastUpdate;
    }

    public void setLastUpdate(Long lastUpdate) {
        this.lastUpdate = lastUpdate;
    }

    public DataContext getContext() {
        return context;
    }

    public void setContext(DataContext context) {
        this.context = context;
    }

    public String getPeid() {
        return peid;
    }

    public void setPeid(String peid) {
        this.peid = peid;
    }

    public String getQeid() {
        return qeid;
    }

    public void setQeid(String qeid) {
        this.qeid = qeid;
    }

    public String getProcedure() {
        return procedure;
    }

    public void setProcedure(String procedure) {
        this.procedure = procedure;
    }

    public String getParameter() {
        return parameter;
    }

    public void setParameter(String parameter) {
        this.parameter = parameter;
    }
    
}