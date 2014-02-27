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

import java.util.List;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import org.mousephenotype.dcc.entities.qc.AnIssue;
import org.mousephenotype.dcc.entities.qc.CitedDataPoint;
import org.mousephenotype.dcc.entities.qc.CitedMeasurement;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.CitedMeasurementsPack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("citeddatapoints")
public class CitedDataPointsFacadeREST extends AbstractFacade<CitedDataPoint> {

    public CitedDataPointsFacadeREST() {
        super(CitedDataPoint.class);
    }

    @GET
    @Path("{issueId}")
    @Produces(MediaType.APPLICATION_JSON)
    public CitedMeasurementsPack extjsFindAll(
            @PathParam("issueId") Long issueId,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        CitedMeasurementsPack p = new CitedMeasurementsPack();
        if (isValidSession(sessionId, userId)) {
            EntityManager em = getEntityManager();
            AnIssue issue = em.find(AnIssue.class, issueId);
            if (issue != null) {
                TypedQuery<CitedMeasurement> q =
                        em.createNamedQuery("CitedDataPoint.measurementsByIssueId",
                        CitedMeasurement.class);
                q.setParameter("issueId", issue);
                List<CitedMeasurement> r = q.getResultList();
                if (r != null) {
                    p.setDataSet(r);
                    TypedQuery<Long> c =
                            em.createNamedQuery("CitedDataPoint.countByIssueId",
                            Long.class);
                    c.setParameter("issueId", issue);
                    p.setCount(c.getSingleResult());
                }
            }
            em.close();
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
