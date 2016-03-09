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
import javax.persistence.*;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.XmlTransient;
import javax.xml.bind.annotation.XmlType;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Entity
@Table(name = "genotype", catalog = "phenodcc_overviews")
@XmlRootElement
@XmlType(propOrder = {"id", "cid", "gid", "sid", "geneSymbol", "geneId", "geneName", "alleleName", "strain", "genotype"})
@NamedQueries({
    @NamedQuery(name = "GeneStrain.findByCentrePipeline", query = "SELECT new org.mousephenotype.dcc.qualitycontrol.entities.GeneStrain(d.cid, d.gid, d.sid, g.geneSymbol, g.geneId, g.geneName, g.alleleName, s.strain, g.genotype, MAX(d.stateId.cid), SUM(d.numIssues - d.numResolved)) FROM DataContext d join Genotype g on (d.gid = g.genotypeId) join Strain s on (d.sid = s.strainId) join Parameter q on (q.parameterId = d.qid) left join IgnoreProcedures ip on (ip.procedureId = d.pid) WHERE (d.cid = :cid AND d.lid = :lid AND d.numMeasurements > 0 AND q.graphType IS NOT NULL and ip.procedureId is null AND (d.qid != 2100 or (d.pid = 103 AND d.qid = 2100)) AND q.type != 'procedureMetadata') GROUP BY d.cid, d.gid, d.sid ORDER BY s.strain, g.geneSymbol"),
})
public class GeneStrain implements Serializable {
    private static final long serialVersionUID = 1L;
    @EmbeddedId
    protected GeneStrainPK id;
    private Integer cid;
    private Integer gid;
    private Integer sid;
    private String geneSymbol;
    private String geneId;
    private String geneName;
    private String alleleName;
    private String strain;
    private String genotype;
    private Short stateId;
    private Long numUnresolved;

    public GeneStrain() {
    }

    public GeneStrain(Integer cid, Integer gid, Integer sid, String geneSymbol,
            String geneId, String geneName, String alleleName, String strain,
            String genotype, Short stateId, Long numUnresolved) {
        this.id = new GeneStrainPK(cid, gid, sid);
        this.cid = cid;
        this.gid = gid;
        this.sid = sid;
        this.geneSymbol = geneSymbol;
        this.geneId = geneId;
        this.geneName = geneName;
        this.alleleName = alleleName;
        this.strain = strain;
        this.genotype = genotype;
        this.stateId = stateId;
        this.numUnresolved = numUnresolved;
    }

    @XmlTransient
    public GeneStrainPK getId() {
        return id;
    }

    public void setId(GeneStrainPK id) {
        this.id = id;
    }

    public Integer getCid() {
        return cid;
    }

    public void setCid(Integer cid) {
        this.cid = cid;
    }

    public Integer getGid() {
        return gid;
    }

    public void setGid(Integer gid) {
        this.gid = gid;
    }

    public Integer getSid() {
        return sid;
    }

    public void setSid(Integer sid) {
        this.sid = sid;
    }

    public String getGeneSymbol() {
        return geneSymbol;
    }

    public void setGeneSymbol(String geneSymbol) {
        this.geneSymbol = geneSymbol;
    }

    public String getGeneId() {
        return geneId;
    }

    public void setGeneId(String geneId) {
        this.geneId = geneId;
    }

    public String getGeneName() {
        return geneName;
    }

    public void setGeneName(String geneName) {
        this.geneName = geneName;
    }

    public String getAlleleName() {
        return alleleName;
    }

    public void setAlleleName(String alleleName) {
        this.alleleName = alleleName;
    }

    public String getStrain() {
        return strain;
    }

    public void setStrain(String strain) {
        this.strain = strain;
    }

    public String getGenotype() {
        return genotype;
    }

    public void setGenotype(String genotype) {
        this.genotype = genotype;
    }

    public Short getStateId() {
        return stateId;
    }

    public void setStateId(Short stateId) {
        this.stateId = stateId;
    }

    public Long getNumUnresolved() {
        return numUnresolved;
    }

    public void setNumUnresolved(Long numUnresolved) {
        this.numUnresolved = numUnresolved;
    }
    
}
