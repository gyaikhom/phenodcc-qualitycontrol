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
package org.mousephenotype.dcc.qualitycontrol.webservice;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.NoResultException;
import javax.persistence.TypedQuery;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import org.eclipse.persistence.exceptions.DatabaseException;
import org.mousephenotype.dcc.entities.qc.AUser;
import org.mousephenotype.dcc.entities.qc.AnAction;
import org.mousephenotype.dcc.entities.qc.AnIssue;
import org.mousephenotype.dcc.entities.qc.DataContext;
import org.mousephenotype.dcc.entities.qc.History;
import org.mousephenotype.dcc.entities.qc.IssueStatus;
import org.mousephenotype.dcc.qualitycontrol.entities.AnActionRequest;
import org.mousephenotype.dcc.qualitycontrol.entities.AnActionResponse;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.AnActionPack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("actions")
public class AnActionFacadeREST extends AbstractFacade<AnAction> {

    /* the following must match cid in phenodcc_qc.action_type */
    private static final Integer ACCEPT_ISSUE = 2;
    private static final Integer RESOLVE_ISSUE = 4;
    private static final Integer DELETE_ISSUE = 11;

    /* the following must match cid in phenodcc_qc.issue_status */
    private static final Integer ISSUE_ACCEPTED = 1;
    private static final Integer ISSUE_RESOLVED = 4;

    public AnActionFacadeREST() {
        super(AnAction.class);
    }

    private AnAction doAction(Integer userId,
            AnActionRequest request, EntityManager em) {
        AnAction action = request.getAction(em);
        try {
            em.getTransaction().begin();
            em.persist(action);
            em.flush();
            em.refresh(action);

            DataContext context = action.getIssueId().getContextId();
            em.persist(new History(context, userId, action.getActionType(),
                    context.getStateId(), action, action.getIssueId()));

            Integer actionType = request.getActionType();
            Integer issueStatus = -1;

            if (Objects.equals(actionType, ACCEPT_ISSUE)) {
                issueStatus = ISSUE_ACCEPTED;
            } else if (Objects.equals(actionType, RESOLVE_ISSUE)) {
                issueStatus = ISSUE_RESOLVED;
            }

            if (issueStatus != -1) {
                TypedQuery<IssueStatus> query
                        = em.createNamedQuery("IssueStatus.findByCid",
                                IssueStatus.class);
                query.setParameter("cid", issueStatus);
                query.setMaxResults(1);
                IssueStatus status = query.getSingleResult();
                if (status != null) {
                    AnIssue issue = action.getIssueId();
                    issue.setStatus(status);

                    if (Objects.equals(actionType, RESOLVE_ISSUE)
                            && context.getNumIssues() > context.getNumResolved()) {
                        context.setNumResolved(context.getNumResolved() + 1);
                    }
                }
            }
            em.getTransaction().commit();
            em.refresh(action);
        } catch (DatabaseException e) {
            action = null;
        }
        return action;
    }

    private AnAction markIssueAsDeleted(Integer userId,
            AnActionRequest request, EntityManager em) {
        AnAction action = request.getAction(em);
        AnIssue issue = action.getIssueId();

        /* issues can only be deleted by the user who raised it */
        if (issue.getRaisedBy().compareTo(userId) != 0) {
            return action;
        }

        try {
            TypedQuery<History> historyQuery
                    = em.createNamedQuery("History.findByIssueId",
                            History.class);
            historyQuery.setParameter("issueId", issue);
            List<History> historyEntries = historyQuery.getResultList();
            DataContext context = action.getIssueId().getContextId();

            em.getTransaction().begin();
            if (context.getNumIssues() > 0) {
                /* we are deleting an issue */
                context.setNumIssues(context.getNumIssues() - 1);
                
                /* if deleted issue was initially marked as resolved, then also
                decrement the number of resolved issues. */
                if (issue.getStatus().getCid().intValue() == ISSUE_RESOLVED
                        && context.getNumResolved() > 0) {
                    context.setNumResolved(context.getNumResolved() - 1);
                }
            } else {
                /* fix the number of issues and number of resolved issues */
                context.setNumIssues(0);
                context.setNumResolved(0);
            }
            em.flush();
            em.refresh(context);
            issue.setIsDeleted(1);
            em.flush();
            em.refresh(issue);

            Iterator<History> entries = historyEntries.iterator();
            while (entries.hasNext()) {
                History history = entries.next();
                history.setIsDeleted(1);
                em.flush();
            }
            em.getTransaction().commit();
        } catch (DatabaseException e) {
            action = null;
        }
        return action;
    }

    @POST
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public AnAction createAction(AnActionRequest request,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnAction action = null;
        if (isValidSession(sessionId, userId)) {
            EntityManager em = getEntityManager();
            if (Objects.equals(request.getActionType(), DELETE_ISSUE)) {
                action = markIssueAsDeleted(userId, request, em);
            } else {
                action = doAction(userId, request, em);
            }
            em.close();
        }
        return action;
    }

    private AUser getUser(Integer id) {
        EntityManager em = getDrupalEntityManager();
        AUser r = null;
        try {
            r = em.find(AUser.class, id);
        } catch (Exception e) {
            System.err.println("Unable to find user with id "
                    + id + " in Drupal database.");
        } finally {
            em.close();
        }
        return r;
    }

    private AnActionResponse prepareActionResponse(AnAction action) {
        AnActionResponse returnValue = null;
        if (action != null) {
            EntityManager em = getEntityManager();
            AUser actionedBy = getUser(action.getActionedBy());
            if (actionedBy == null) {
                System.err.println("Failed to retrieve action details from database");
            } else {
                returnValue = new AnActionResponse(action.getId(),
                        action.getDescription(),
                        actionedBy.toString(),
                        action.getActionType().getShortName(),
                        action.getLastUpdate().getTime());
            }
            em.close();
        }
        return returnValue;
    }

    @GET
    @Path("extjs/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public AnActionPack extjsFind(
            @PathParam("id") Long id,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnActionPack p = new AnActionPack();
        if (isValidSession(sessionId, userId)) {
            AnAction action = super.find(id);
            if (action == null) {
                p.setDataSet(null, 0L);
            } else {
                ArrayList<AnActionResponse> t
                        = new ArrayList<>();
                t.add(prepareActionResponse(action));
                p.setDataSet(t);
            }
        } else {
            p.sessionHasExpired();
        }
        return p;
    }

    @GET
    @Path("extjs/all")
    @Produces(MediaType.APPLICATION_JSON)
    public AnActionPack extjsFindAll(
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnActionPack p = new AnActionPack();
        if (isValidSession(sessionId, userId)) {
            List<AnAction> actions = super.findAll();
            if (actions.isEmpty()) {
                p.setDataSet(null, 0L);
            } else {
                ArrayList<AnActionResponse> t
                        = new ArrayList<>();
                Iterator<AnAction> i = actions.iterator();
                while (i.hasNext()) {
                    t.add(prepareActionResponse(i.next()));
                }
                p.setDataSet(t);
            }
        } else {
            p.sessionHasExpired();
        }
        return p;
    }

    @GET
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    public AnActionPack extjsFindByIssue(
            @QueryParam("issueId") Long id,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnActionPack p = new AnActionPack();
        if (isValidSession(sessionId, userId)) {
            p.setDataSet(null, 0L);

            EntityManager em = getEntityManager();
            AnIssue issue = em.find(AnIssue.class, id);
            if (issue != null) {
                TypedQuery<AnAction> actionQuery
                        = em.createNamedQuery("AnAction.findByIssueId",
                                AnAction.class);
                actionQuery.setParameter("issueId", issue);
                try {
                    List<AnAction> actions = actionQuery.getResultList();
                    if (!actions.isEmpty()) {
                        ArrayList<AnActionResponse> t
                                = new ArrayList<>();
                        Iterator<AnAction> i = actions.iterator();
                        while (i.hasNext()) {
                            t.add(prepareActionResponse(i.next()));
                        }
                        p.setDataSet(t);
                    }
                } catch (NoResultException e) {
                }
            }
            em.close();
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
