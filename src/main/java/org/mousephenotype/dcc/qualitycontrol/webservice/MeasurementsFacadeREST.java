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
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import org.mousephenotype.dcc.crawler.entities.XmlFile;
import org.mousephenotype.dcc.entities.overviews.MeasuredValues;
import org.mousephenotype.dcc.entities.overviews.MetadataGroupToValues;
import org.mousephenotype.dcc.entities.overviews.ProcedureMetadataGroup;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.MeasurementsPack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("measurements")
public class MeasurementsFacadeREST extends AbstractFacade<MeasuredValues> {

    public MeasurementsFacadeREST() {
        super(MeasuredValues.class);
    }

    private List<MeasuredValues> getMutantMeasurements(
            Integer centreId,
            Integer pipelineId,
            Integer genotypeId,
            Integer strainId,
            String procedureKey,
            String parameterKey) {
        EntityManager em = getEntityManager();
        List<MeasuredValues> temp = null;
        try {
            TypedQuery<MeasuredValues> query
                    = em.createNamedQuery(
                            "MeasurementsPerformed.findMutantMeasurements",
                            MeasuredValues.class);
            query.setParameter("centreId", centreId);
            query.setParameter("pipelineId", pipelineId);
            query.setParameter("genotypeId", genotypeId);
            query.setParameter("strainId", strainId);
            query.setParameter("procedureKey", procedureKey);
            query.setParameter("parameterKey", parameterKey);
            temp = query.getResultList();
            for (MeasuredValues m : temp) {
                XmlFile xf = em.find(XmlFile.class, m.getTrackerId());
                if (xf != null) {
                    m.setLastModified(xf.getLastUpdate());
                }
            }
            em.close();
        } catch (Exception e) {
            System.err.println(e.getMessage());
        }
        return temp;
    }

    private List<MeasuredValues> getBaselineMeasurements(
            Integer centreId,
            Integer strainId,
            String parameterKey,
            ProcedureMetadataGroup t) {
        EntityManager em = getEntityManager();
        List<MeasuredValues> temp = null;
        try {
            TypedQuery<MeasuredValues> query
                    = em.createNamedQuery(
                            "MeasurementsPerformed.findBaselineMeasurements",
                            MeasuredValues.class);
            query.setParameter("centreId", centreId);
            query.setParameter("pipeline", t.getPipeline());
            query.setParameter("strainId", strainId);
            query.setParameter("procedureId", t.getProcedureId());
            query.setParameter("parameterId", parameterKey);
            query.setParameter("metadataGroup", t.getMetadataGroup());
            temp = query.getResultList();
            for (MeasuredValues m : temp) {
                XmlFile xf = em.find(XmlFile.class, m.getTrackerId());
                if (xf != null) {
                    m.setLastModified(xf.getLastUpdate());
                }
            }
            em.close();
        } catch (Exception e) {
            System.err.println(e.getMessage());
        }
        return temp;
    }

    private MetadataGroupToValues getMetadataGroupValue(String mg) {
        MetadataGroupToValues v = null;
        EntityManager em = getEntityManager();
        try {
            TypedQuery<MetadataGroupToValues> query
                    = em.createNamedQuery(
                            "MetadataGroupToValues.findByMetadataGroup",
                            MetadataGroupToValues.class);
            query.setParameter("metadataGroup", mg);
            query.setMaxResults(1);
            v = query.getSingleResult();
        } catch (Exception e) {
            System.err.println(e.getMessage());
        }
        em.close();
        return v;
    }

    // We do not wish to send the meta-data group checksum or the values
    // for every measurement. So, we group all of the distinct meta-data groups
    // and send them with the measurements. Within each measurement, we replace
    // the meta-data group checksum with the id.
    private List<MetadataGroupToValues> convertMetadataGroupsToIndices(List<MeasuredValues> g) {
        List<MetadataGroupToValues> mgs = new ArrayList<>();
        HashMap<String, MetadataGroupToValues> distinct = new HashMap<>();
        Iterator<MeasuredValues> i = g.iterator();
        while (i.hasNext()) {
            MeasuredValues v = i.next();
            String checksum = v.getMetadataGroup();
            MetadataGroupToValues mg = distinct.get(checksum);
            if (mg == null) {
                mg = getMetadataGroupValue(checksum);
                if (mg != null) {
                    distinct.put(checksum, mg);
                    mgs.add(mg);
                }
            }
            v.setMetadataGroupIndex(mg == null
                    ? -1L : mg.getMetadataGroupToValuesId());
        }
        return mgs;
    }

    public List<ProcedureMetadataGroup> getProcedureMetadataGroups(
            Integer centreId,
            Integer pipelineId,
            Integer genotypeId,
            Integer strainId,
            String procedureKey,
            String parameterKey) {
        List<ProcedureMetadataGroup> t = null;
        EntityManager em = getEntityManager();
        TypedQuery<ProcedureMetadataGroup> q
                = em.createNamedQuery("ProcedureAnimalOverview.findByCidLidGidSidPeidQeid",
                        ProcedureMetadataGroup.class);
        q.setParameter("centreId", centreId);
        q.setParameter("pipelineId", pipelineId);
        q.setParameter("genotypeId", genotypeId);
        q.setParameter("strainId", strainId);
        q.setParameter("procedureId", procedureKey);
        q.setParameter("parameterId", parameterKey);
        try {
            t = q.getResultList();
        } catch (Exception e) {
        }
        em.close();
        return t;
    }

    @GET
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    public MeasurementsPack extjsFindBy(
            @QueryParam("cid") Integer centreId,
            @QueryParam("lid") Integer pipelineId,
            @QueryParam("gid") Integer genotypeId,
            @QueryParam("sid") Integer strainId,
            @QueryParam("peid") String procedureKey,
            @QueryParam("qeid") String parameterKey,
            @QueryParam("ib") Boolean includeBaseline,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        MeasurementsPack p = new MeasurementsPack();
        if (isValidSession(sessionId, userId)) {
            if (centreId == null || pipelineId == null
                    || genotypeId == null || strainId == null
                    || procedureKey == null || procedureKey.isEmpty()
                    || parameterKey == null || parameterKey.isEmpty()) {
                p.setDataSet(null, 0L);
            } else {
                List<ProcedureMetadataGroup> t = getProcedureMetadataGroups(
                        centreId, pipelineId, genotypeId, strainId,
                        procedureKey, parameterKey);
                if (t == null || t.isEmpty()) {
                    p.setDataSet(null, 0L);
                } else {
                    List<MeasuredValues> temp
                            = getMutantMeasurements(centreId, pipelineId,
                                    genotypeId, strainId,
                                    t.get(0).getProcedureId(), parameterKey);
                    if (genotypeId != 0 && includeBaseline != null && includeBaseline) {
                        Iterator<ProcedureMetadataGroup> i = t.iterator();
                        while (i.hasNext()) {
                            temp.addAll(getBaselineMeasurements(centreId,
                                    strainId, parameterKey, i.next()));
                        }
                    }
                    List<MetadataGroupToValues> mgs = convertMetadataGroupsToIndices(temp);
                    p.setMetadataGroups(mgs);
                    p.setDataSet(temp);
                }
            }
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
