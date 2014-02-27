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
import javax.persistence.EntityManager;
import javax.persistence.Id;
import javax.persistence.TypedQuery;
import org.mousephenotype.dcc.entities.qc.ActionType;
import org.mousephenotype.dcc.entities.qc.AnAction;
import org.mousephenotype.dcc.entities.qc.AnIssue;
import org.mousephenotype.dcc.entities.qc.DataContext;
import org.mousephenotype.dcc.entities.qc.IssueStatus;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Entity
public class AnIssueRequest implements Serializable {

    private static final long serialVersionUID = 1L;
    @Id
    private Long id;
    private Short priority;
    private Integer status;
    private Long contextId;
    private Integer raisedBy;
    private Integer assignedTo;
    private Long lastupdate;
    private String title;
    private String description;
    private Integer[] datapoints;
    
    /* the following must match consistent identifiers in the database */
    private static final Integer RAISE_ISSUE = 0;

    public AnIssueRequest() {
    }

    public AnIssueRequest(Long id, String title, String description,
            Short priority, Integer status, Long contextId,
            Integer[] datapoints, Integer raisedBy, Integer assignedTo,
            Long lastUpdate) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.contextId = contextId;
        this.datapoints = datapoints;
        this.priority = priority;
        this.status = status;
        this.raisedBy = raisedBy;
        this.assignedTo = assignedTo;
        this.lastupdate = lastUpdate;
    }

    private IssueStatus getIssueStatus(EntityManager em, Integer status) {
        TypedQuery<IssueStatus> query =
                em.createNamedQuery("IssueStatus.findByCid", IssueStatus.class);
        query.setParameter("cid", status);
        return query.getSingleResult();
    }

    public AnIssue getIssue(EntityManager em) {
        AnIssue issue = new AnIssue();
        issue.setContextId(em.find(DataContext.class, contextId));
        issue.setTitle(title);
        issue.setPriority(priority);
        issue.setStatus(getIssueStatus(em, status));
        issue.setRaisedBy(raisedBy);
        issue.setAssignedTo(assignedTo);
        return issue;
    }

    private ActionType getActionType(EntityManager em, Integer type) {
        TypedQuery<ActionType> q = em.createNamedQuery(
                "ActionType.findByCid", ActionType.class);
        q.setParameter("cid", type);
        q.setMaxResults(1);
        return q.getSingleResult();
    }

    public AnAction getAction(EntityManager em) {
        AnAction action = new AnAction();
        action.setDescription(description);
        action.setActionType(getActionType(em, RAISE_ISSUE));
        action.setActionedBy(raisedBy);
        return action;
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

    public Short getPriority() {
        return priority;
    }

    public void setPriority(Short priority) {
        this.priority = priority;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public Long getContextId() {
        return contextId;
    }

    public void setContextId(Long contextId) {
        this.contextId = contextId;
    }

    public Integer[] getDatapoints() {
        return datapoints;
    }

    public void setDatapoints(Integer[] datapoints) {
        this.datapoints = datapoints;
    }

    public Integer getRaisedBy() {
        return raisedBy;
    }

    public void setRaisedBy(Integer raisedBy) {
        this.raisedBy = raisedBy;
    }

    public Integer getAssignedTo() {
        return assignedTo;
    }

    public void setAssignedTo(Integer assignedTo) {
        this.assignedTo = assignedTo;
    }

    public Long getLastupdate() {
        return lastupdate;
    }

    public void setLastupdate(Long lastupdate) {
        this.lastupdate = lastupdate;
    }
}